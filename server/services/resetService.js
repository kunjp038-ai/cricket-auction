const { Player, Team, Auction, Bid, Transaction, Round, Settings } = require('../models');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { emitAuctionEvent } = require('../utils/socket');
const { formatINR } = require('../utils/format');

const sessionOpts = (session) => (session ? { session } : {});

/**
 * Fresh start for the auction (admin "Reset auction" button).
 *  - deletes all auction records, bids, rounds and non-initial ledger entries
 *  - every player goes back to Available (Captain/Icon picks are kept when keepSpecial = true)
 *  - every team's squad and budget are rebuilt from its kept picks; their SOLD records and
 *    ledger entries are recreated so history/ledger stay consistent
 *  - a missing "Initial budget" ledger entry is added for any team
 *  - round 1 reopened, pending auto-start cleared
 * Players, teams, captains, settings and photos are NOT touched.
 */
async function resetAuction({ keepSpecial = true, adminId }) {
  const summary = await runInTransaction(async (session) => {
    const settings = await Settings.get(session);
    const now = new Date();

    const keep = keepSpecial
      ? await Player.find({ squadRole: { $in: ['Captain', 'Icon'] }, currentTeam: { $ne: null } }).session(session)
      : [];
    const keepIds = keep.map((p) => p._id);

    const [a, b, r, t] = await Promise.all([
      Auction.deleteMany({}).session(session),
      Bid.deleteMany({}).session(session),
      Round.deleteMany({}).session(session),
      Transaction.deleteMany({ type: { $ne: 'INITIAL_BUDGET' } }).session(session),
    ]);

    const res = await Player.updateMany(
      { _id: { $nin: keepIds } },
      { $set: { status: 'Available', currentTeam: null, soldPrice: 0, squadRole: '', auctionRound: 1, releaseCount: 0, lastReleasedAt: null } }
    ).session(session);

    const teams = await Team.find().session(session);
    let picksKept = 0;
    for (const team of teams) {
      const hasInitial = await Transaction.exists({ team: team._id, type: 'INITIAL_BUDGET' }).session(session);
      if (!hasInitial) {
        await Transaction.create(
          [{ team: team._id, type: 'INITIAL_BUDGET', amount: team.totalBudget, balanceAfter: team.totalBudget, description: `Initial budget ${formatINR(team.totalBudget)}`, createdAt: team.createdAt }],
          sessionOpts(session)
        );
      }
      const picks = keep.filter((p) => String(p.currentTeam) === String(team._id));
      let used = 0;
      team.players = [];
      for (const p of picks) {
        const price = p.squadRole === 'Captain' ? settings.captainPrice : settings.iconPrice;
        p.soldPrice = price;
        p.status = 'Sold';
        p.auctionRound = 1;
        await p.save(sessionOpts(session));
        team.players.push(p._id);
        used += price;
        const [auction] = await Auction.create(
          [{
            player: p._id, round: 1, status: 'SOLD', saleType: p.squadRole === 'Captain' ? 'CAPTAIN' : 'ICON',
            basePrice: price, currentBid: price, bidCount: 0, finalBid: price, highestBidder: team._id, winningTeam: team._id,
            startedAt: now, completedAt: now, conductedBy: adminId || null,
          }],
          sessionOpts(session)
        );
        await Transaction.create(
          [{
            team: team._id, player: p._id, auction: auction._id, type: 'PLAYER_PURCHASE', amount: -price,
            balanceAfter: team.totalBudget - used, round: 1,
            description: `${p.squadRole} pick: ${p.name} (fixed price ${formatINR(price)})`, createdBy: adminId || null,
          }],
          sessionOpts(session)
        );
        picksKept += 1;
      }
      team.usedBudget = used;
      await team.save(sessionOpts(session));
    }

    const poolSize = await Player.countDocuments({ status: 'Available' }).session(session);
    await Round.create([{ number: 1, playersAtStart: poolSize }], sessionOpts(session));
    settings.currentRound = 1;
    settings.pendingNextAt = null;
    await settings.save(sessionOpts(session));

    return {
      deleted: { auctions: a.deletedCount, bids: b.deletedCount, rounds: r.deletedCount, ledgerEntries: t.deletedCount },
      playersAvailable: poolSize,
      playersReset: res.modifiedCount,
      picksKept,
      teams: teams.length,
    };
  });

  emitAuctionEvent('round:started', { message: 'Auction reset: Round 1, all players available' });
  return summary;
}

module.exports = { resetAuction };
