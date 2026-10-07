const { Player, Team, Auction, Bid, Transaction, Round, Settings } = require('../models');
const { POOL_STATUSES } = require('../models/Player');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { emitAuctionEvent } = require('../utils/socket');
const { formatINR } = require('../utils/format');

const TEAM_FIELDS = 'name logo color totalBudget usedBudget remainingBudget maxPlayers minPlayers players captain';
const sessionOpts = (session) => (session ? { session } : {});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function ensureRound(number, session) {
  let round = await Round.findOne({ number }).session(session || null);
  if (!round) {
    const poolSize = await Player.countDocuments({ status: { $in: POOL_STATUSES } }).session(session || null);
    [round] = await Round.create([{ number, playersAtStart: poolSize }], sessionOpts(session));
  }
  return round;
}

async function getRoundStats(roundNumber) {
  const [playersRemaining, soldThisRound, unsoldThisRound, totalSold, totalUnsold, totalPlayers] = await Promise.all([
    Player.countDocuments({ status: { $in: POOL_STATUSES } }),
    Auction.countDocuments({ round: roundNumber, status: 'SOLD' }),
    Auction.countDocuments({ round: roundNumber, status: 'UNSOLD' }),
    Player.countDocuments({ status: 'Sold' }),
    Player.countDocuments({ status: 'Unsold' }),
    Player.countDocuments(),
  ]);
  return { round: roundNumber, playersRemaining, soldThisRound, unsoldThisRound, totalSold, totalUnsold, totalPlayers };
}

function computeNextBid(auction, settings) {
  if (!auction) return null;
  return auction.bidCount === 0 ? auction.basePrice : auction.currentBid + settings.bidIncrement;
}

/** Full snapshot of the live auction screen: sent on every REST read and every socket event. */
async function getCurrentState() {
  const settings = await Settings.get();
  const [auction, teams, stats] = await Promise.all([
    Auction.findOne({ status: 'LIVE' })
      .populate('player')
      .populate('highestBidder', 'name logo color')
      .populate('previousTeam', 'name logo color'),
    Team.find().sort({ name: 1 }).select(TEAM_FIELDS).populate('captain', 'name photo'),
    getRoundStats(settings.currentRound),
  ]);

  let bids = [];
  if (auction) {
    bids = await Bid.find({ auction: auction._id }).sort({ createdAt: -1 }).limit(25).populate('team', 'name color logo');
  }

  return { auction, bids, teams, settings, stats, nextBidAmount: computeNextBid(auction, settings) };
}

async function broadcast(event, extra = {}) {
  const state = await getCurrentState();
  emitAuctionEvent(event, { ...extra, state });
  return state;
}

/* ------------------------------------------------------------------ */
/* Start / Next                                                        */
/* ------------------------------------------------------------------ */

async function startAuction({ playerId, adminId }) {
  const live = await Auction.findOne({ status: 'LIVE' });
  if (live) throw ApiError.conflict('An auction is already live. Mark the current player SOLD or UNSOLD first.');

  const settings = await Settings.get();

  let player;
  if (playerId) {
    player = await Player.findById(playerId);
    if (!player) throw ApiError.notFound('Player not found');
    if (!POOL_STATUSES.includes(player.status)) {
      throw ApiError.badRequest(`Player is "${player.status}" and cannot be auctioned right now.`);
    }
  } else {
    // Released / re-auction players first, then fresh players, alphabetically.
    player = await Player.findOne({ status: { $in: POOL_STATUSES } }).sort({ status: -1, name: 1 });
    if (!player) throw ApiError.badRequest('No players left in the auction pool.');
  }

  // Remember the previous owner for the "allow previous team to re-bid" rule.
  let previousTeam = null;
  if (player.releaseCount > 0) {
    const lastSale = await Auction.findOne({ player: player._id, status: 'SOLD' }).sort({ completedAt: -1 });
    previousTeam = lastSale ? lastSale.winningTeam : null;
  }

  await ensureRound(settings.currentRound);

  const auction = await Auction.create({
    player: player._id,
    round: settings.currentRound,
    status: 'LIVE',
    basePrice: player.basePrice,
    currentBid: 0,
    bidCount: 0,
    previousTeam,
    conductedBy: adminId || null,
  });

  player.auctionRound = settings.currentRound;
  await player.save();

  const state = await broadcast('auction:started', {
    message: `${player.name} is now up for auction (base ${formatINR(player.basePrice)})`,
  });
  return { auction: state.auction, state };
}

async function nextPlayer({ adminId }) {
  const live = await Auction.findOne({ status: 'LIVE' });
  let autoUnsold = false;

  if (live) {
    if (live.bidCount > 0) {
      throw ApiError.badRequest('The current player has bids. Mark the player SOLD or UNSOLD before moving on.');
    }
    await markUnsold({ auctionId: live._id, adminId, silent: true });
    autoUnsold = true;
  }

  const poolSize = await Player.countDocuments({ status: { $in: POOL_STATUSES } });
  if (poolSize === 0) {
    const state = await broadcast('auction:pool-empty', {
      message: 'All players have been auctioned in this round. Start a re-auction round for unsold players.',
    });
    return { auction: null, poolEmpty: true, autoUnsold, state };
  }

  const result = await startAuction({ adminId });
  return { ...result, autoUnsold, poolEmpty: false };
}

/* ------------------------------------------------------------------ */
/* Bidding                                                             */
/* ------------------------------------------------------------------ */

async function placeBid({ auctionId, teamId, adminId }) {
  const [auction, team, settings] = await Promise.all([
    Auction.findById(auctionId),
    Team.findById(teamId),
    Settings.get(),
  ]);

  if (!auction) throw ApiError.notFound('Auction not found');
  if (auction.status !== 'LIVE') throw ApiError.badRequest('This auction is no longer live.');
  if (!team) throw ApiError.notFound('Team not found');

  if (team.players.length >= team.maxPlayers) {
    throw ApiError.badRequest(`${team.name} has reached its maximum squad size (${team.maxPlayers} players).`);
  }
  if (auction.highestBidder && auction.highestBidder.equals(team._id)) {
    throw ApiError.badRequest(`${team.name} is already the highest bidder.`);
  }
  if (auction.previousTeam && auction.previousTeam.equals(team._id) && !settings.allowPreviousTeamRebid) {
    throw ApiError.badRequest(`${team.name} previously owned this player and re-bidding by the previous team is disabled.`);
  }

  const nextAmount = computeNextBid(auction, settings);
  if (settings.maxBid > 0 && nextAmount > settings.maxBid) {
    throw ApiError.badRequest(`Bid of ${formatINR(nextAmount)} exceeds the maximum bid limit of ${formatINR(settings.maxBid)}.`);
  }
  if (nextAmount > team.remainingBudget) {
    throw ApiError.badRequest('Insufficient budget for this bid.', {
      required: nextAmount,
      remaining: team.remainingBudget,
      team: team.name,
    });
  }

  // Optimistic concurrency: the update only applies if no other bid landed in between.
  const updated = await Auction.findOneAndUpdate(
    { _id: auction._id, status: 'LIVE', bidCount: auction.bidCount },
    { $set: { currentBid: nextAmount, highestBidder: team._id }, $inc: { bidCount: 1 } },
    { new: true }
  );
  if (!updated) throw ApiError.conflict('Another bid was placed at the same moment. Please try again.');

  const bid = await Bid.create({
    auction: auction._id,
    player: auction.player,
    team: team._id,
    bidderName: team.name,
    amount: nextAmount,
    round: auction.round,
    placedBy: adminId || null,
  });

  const state = await broadcast('auction:bid', {
    bid: { team: team.name, amount: nextAmount, teamId: team._id },
    message: `${team.name} bids ${formatINR(nextAmount)}`,
  });
  return { bid, state };
}

/* ------------------------------------------------------------------ */
/* SOLD / UNSOLD / CANCEL                                              */
/* ------------------------------------------------------------------ */

/**
 * Marks the live auction SOLD.
 * Two modes:
 *  - Direct entry (teams bid verbally, admin records the result): pass `teamId` + `amount`.
 *    The final price is validated against base price, max bid, budget and the re-bid rule,
 *    stored as a single Bid record and then the sale proceeds.
 *  - Button bidding: omit teamId/amount and the current highest bidder wins at the current bid.
 */
async function markSold({ auctionId, adminId, teamId, amount }) {
  const result = await runInTransaction(async (session) => {
    const auction = await Auction.findById(auctionId).session(session);
    if (!auction) throw ApiError.notFound('Auction not found');
    if (auction.status !== 'LIVE') throw ApiError.badRequest('This auction is no longer live.');

    if (teamId) {
      const team = await Team.findById(teamId).session(session);
      if (!team) throw ApiError.notFound('Team not found');
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw ApiError.badRequest('Enter a valid sold price.');
      if (amt < auction.basePrice) {
        throw ApiError.badRequest(`Sold price cannot be lower than the base price (${formatINR(auction.basePrice)}).`);
      }
      const settings = await Settings.get(session);
      if (settings.maxBid > 0 && amt > settings.maxBid) {
        throw ApiError.badRequest(`Sold price ${formatINR(amt)} exceeds the maximum bid limit of ${formatINR(settings.maxBid)}.`);
      }
      if (auction.previousTeam && auction.previousTeam.equals(team._id) && !settings.allowPreviousTeamRebid) {
        throw ApiError.badRequest(`${team.name} previously owned this player and re-bidding by the previous team is disabled.`);
      }
      if (team.players.length >= team.maxPlayers) {
        throw ApiError.badRequest(`${team.name} has reached its maximum squad size (${team.maxPlayers} players).`);
      }
      if (amt > team.remainingBudget) {
        throw ApiError.badRequest('Insufficient budget for this bid.', { required: amt, remaining: team.remainingBudget, team: team.name });
      }
      auction.currentBid = amt;
      auction.highestBidder = team._id;
      auction.bidCount += 1;
      await Bid.create(
        [{
          auction: auction._id, player: auction.player, team: team._id, bidderName: team.name,
          amount: amt, round: auction.round, placedBy: adminId || null,
        }],
        sessionOpts(session)
      );
    }

    if (!auction.highestBidder || auction.bidCount === 0) {
      throw ApiError.badRequest('Select the winning team and enter the sold price, or mark the player UNSOLD.');
    }

    const [player, team] = await Promise.all([
      Player.findById(auction.player).session(session),
      Team.findById(auction.highestBidder).session(session),
    ]);
    if (!player) throw ApiError.notFound('Player not found');
    if (!team) throw ApiError.notFound('Winning team not found');

    if (player.status === 'Sold' || player.currentTeam) {
      throw ApiError.badRequest('Player already belongs to a team. Release the player before selling again.');
    }
    if (team.players.length >= team.maxPlayers) {
      throw ApiError.badRequest(`${team.name} has reached its maximum squad size (${team.maxPlayers}).`);
    }

    const finalBid = auction.currentBid;
    if (finalBid > team.remainingBudget) {
      throw ApiError.badRequest('Insufficient budget for this bid.');
    }

    // 1. Close the auction record
    auction.status = 'SOLD';
    auction.finalBid = finalBid;
    auction.winningTeam = team._id;
    auction.completedAt = new Date();
    if (adminId) auction.conductedBy = adminId;
    await auction.save({ session });

    // 2. Update the player
    player.status = 'Sold';
    player.currentTeam = team._id;
    player.soldPrice = finalBid;
    player.auctionRound = auction.round;
    await player.save({ session });

    // 3 + 4. Deduct budget and add to squad (remainingBudget is recomputed and validated >= 0 in the model)
    team.usedBudget += finalBid;
    if (!team.players.some((id) => id.equals(player._id))) team.players.push(player._id);
    await team.save({ session });

    // 5. Ledger entry
    await Transaction.create(
      [{
        team: team._id,
        player: player._id,
        auction: auction._id,
        type: 'PLAYER_PURCHASE',
        amount: -finalBid,
        balanceAfter: team.remainingBudget,
        round: auction.round,
        description: `Purchased ${player.name} for ${formatINR(finalBid)} in Round ${auction.round}`,
        createdBy: adminId || null,
      }],
      sessionOpts(session)
    );

    return { auction, player, team, finalBid };
  });

  const state = await broadcast('auction:sold', {
    sale: {
      player: result.player.name,
      playerId: result.player._id,
      team: result.team.name,
      teamId: result.team._id,
      amount: result.finalBid,
      round: result.auction.round,
    },
    message: `SOLD! ${result.player.name} to ${result.team.name} for ${formatINR(result.finalBid)}`,
  });
  return { ...result, state };
}

async function markUnsold({ auctionId, adminId, silent = false }) {
  const result = await runInTransaction(async (session) => {
    const auction = await Auction.findById(auctionId).session(session);
    if (!auction) throw ApiError.notFound('Auction not found');
    if (auction.status !== 'LIVE') throw ApiError.badRequest('This auction is no longer live.');

    const player = await Player.findById(auction.player).session(session);
    if (!player) throw ApiError.notFound('Player not found');

    auction.status = 'UNSOLD';
    auction.completedAt = new Date();
    auction.finalBid = null;
    auction.winningTeam = null;
    if (adminId) auction.conductedBy = adminId;
    await auction.save({ session });

    player.status = 'Unsold';
    player.currentTeam = null;
    player.soldPrice = 0;
    player.auctionRound = auction.round;
    await player.save({ session });

    return { auction, player };
  });

  if (silent) return result;
  const state = await broadcast('auction:unsold', {
    player: { name: result.player.name, id: result.player._id },
    message: `${result.player.name} goes UNSOLD`,
  });
  return { ...result, state };
}

/** Takes a player off the block without recording a result (e.g. started by mistake). */
async function cancelAuction({ auctionId, adminId }) {
  const result = await runInTransaction(async (session) => {
    const auction = await Auction.findById(auctionId).session(session);
    if (!auction) throw ApiError.notFound('Auction not found');
    if (auction.status !== 'LIVE') throw ApiError.badRequest('Only a live auction can be cancelled.');
    const player = await Player.findById(auction.player).session(session);

    auction.status = 'CANCELLED';
    auction.completedAt = new Date();
    if (adminId) auction.conductedBy = adminId;
    await auction.save({ session });

    if (player) {
      player.status = player.releaseCount > 0 ? 'Re-Auction' : 'Available';
      await player.save({ session });
    }
    return { auction, player };
  });

  const state = await broadcast('auction:cancelled', { message: 'Auction cancelled. Player returned to the pool.' });
  return { ...result, state };
}

/* ------------------------------------------------------------------ */
/* Release / Re-auction                                                */
/* ------------------------------------------------------------------ */

async function releasePlayer({ playerId, adminId }) {
  const result = await runInTransaction(async (session) => {
    const player = await Player.findById(playerId).session(session);
    if (!player) throw ApiError.notFound('Player not found');
    if (player.status !== 'Sold' || !player.currentTeam) {
      throw ApiError.badRequest('Only a SOLD player that belongs to a team can be released.');
    }

    const team = await Team.findById(player.currentTeam).session(session);
    if (!team) throw ApiError.notFound('Owning team not found');

    const soldAuction = await Auction.findOne({
      player: player._id,
      status: 'SOLD',
      winningTeam: team._id,
      releasedAt: null,
    })
      .sort({ completedAt: -1 })
      .session(session);

    const refund = soldAuction ? soldAuction.finalBid : player.soldPrice;
    if (refund > team.usedBudget) {
      throw ApiError.badRequest('Ledger mismatch: refund exceeds the team\'s used budget.');
    }

    // 1. Remove from squad   2. Refund   3. Remaining budget recomputed by model
    team.players = team.players.filter((id) => !id.equals(player._id));
    team.usedBudget -= refund;
    await team.save({ session });

    // 4 + 5. Player goes back into the pool as RE-AUCTION
    player.status = 'Re-Auction';
    player.currentTeam = null;
    player.soldPrice = 0;
    player.releaseCount += 1;
    player.lastReleasedAt = new Date();
    await player.save({ session });

    // 6. Preserve history: the SOLD record stays, we only stamp the release date.
    if (soldAuction) {
      soldAuction.releasedAt = new Date();
      await soldAuction.save({ session });
    }

    await Transaction.create(
      [{
        team: team._id,
        player: player._id,
        auction: soldAuction ? soldAuction._id : null,
        type: 'PLAYER_RELEASE',
        amount: refund,
        balanceAfter: team.remainingBudget,
        round: soldAuction ? soldAuction.round : null,
        description: `Released ${player.name} - refunded ${formatINR(refund)}`,
        createdBy: adminId || null,
      }],
      sessionOpts(session)
    );

    return { player, team, refund, auction: soldAuction };
  });

  const state = await broadcast('player:released', {
    release: { player: result.player.name, team: result.team.name, refund: result.refund },
    message: `${result.player.name} released by ${result.team.name}. ${formatINR(result.refund)} refunded.`,
  });
  return { ...result, state };
}

async function startReAuction({ includeUnsold = true, adminId }) {
  const live = await Auction.findOne({ status: 'LIVE' });
  if (live) throw ApiError.badRequest('Finish the live auction before starting a new round.');

  const [unsoldCount, poolCount] = await Promise.all([
    Player.countDocuments({ status: 'Unsold' }),
    Player.countDocuments({ status: { $in: POOL_STATUSES } }),
  ]);
  const projected = poolCount + (includeUnsold ? unsoldCount : 0);
  if (projected === 0) {
    throw ApiError.badRequest('No players available for re-auction. Mark players Unsold or release players first.');
  }

  const result = await runInTransaction(async (session) => {
    const settings = await Settings.get(session);
    const current = await Round.findOne({ number: settings.currentRound }).session(session);
    if (current) {
      current.status = 'CLOSED';
      current.closedAt = new Date();
      await current.save({ session });
    } else {
      await Round.create(
        [{ number: settings.currentRound, status: 'CLOSED', closedAt: new Date() }],
        sessionOpts(session)
      );
    }

    const nextNumber = settings.currentRound + 1;
    let movedUnsold = 0;
    if (includeUnsold) {
      const r = await Player.updateMany(
        { status: 'Unsold' },
        { $set: { status: 'Re-Auction', auctionRound: nextNumber } }
      ).session(session);
      movedUnsold = r.modifiedCount;
    }
    await Player.updateMany({ status: { $in: POOL_STATUSES } }, { $set: { auctionRound: nextNumber } }).session(session);

    const poolSize = await Player.countDocuments({ status: { $in: POOL_STATUSES } }).session(session);
    const [round] = await Round.create([{ number: nextNumber, playersAtStart: poolSize }], sessionOpts(session));

    settings.currentRound = nextNumber;
    await settings.save({ session });

    return { round, movedUnsold, poolSize };
  });

  const state = await broadcast('round:started', {
    round: result.round.number,
    message: `Round ${result.round.number} started with ${result.poolSize} players`,
  });
  return { ...result, state };
}

/* ------------------------------------------------------------------ */
/* History / Rounds                                                    */
/* ------------------------------------------------------------------ */

async function getHistory(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 200);

  const filter = { status: { $in: ['SOLD', 'UNSOLD'] } };
  if (query.status && ['SOLD', 'UNSOLD', 'CANCELLED', 'LIVE'].includes(query.status)) filter.status = query.status;
  if (query.round) filter.round = Number(query.round);
  if (query.team) filter.winningTeam = query.team;
  if (query.player) filter.player = query.player;
  if (query.released === 'true') filter.releasedAt = { $ne: null };

  if (query.search) {
    const players = await Player.find({ name: new RegExp(query.search, 'i') }).select('_id');
    filter.player = { $in: players.map((p) => p._id) };
  }

  const [items, total] = await Promise.all([
    Auction.find(filter)
      .sort({ completedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('player', 'name playerType battingStyle bowlingStyle photo status currentTeam')
      .populate('winningTeam', 'name logo color')
      .populate('highestBidder', 'name logo color'),
    Auction.countDocuments(filter),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit) };
}

async function getPlayerHistory(playerId) {
  const player = await Player.findById(playerId).populate('currentTeam', 'name logo color');
  if (!player) throw ApiError.notFound('Player not found');

  const auctions = await Auction.find({ player: player._id })
    .sort({ round: 1, startedAt: 1 })
    .populate('winningTeam', 'name logo color')
    .populate('highestBidder', 'name logo color');

  const bids = await Bid.find({ player: player._id }).sort({ createdAt: 1 }).populate('team', 'name color');
  const transactions = await Transaction.find({ player: player._id }).sort({ createdAt: 1 }).populate('team', 'name');

  const timeline = auctions.map((a) => ({
    auctionId: a._id,
    round: a.round,
    status: a.status,
    basePrice: a.basePrice,
    finalBid: a.finalBid,
    team: a.winningTeam,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    releasedAt: a.releasedAt,
    bids: bids.filter((b) => b.auction.equals(a._id)),
  }));

  return { player, timeline, transactions, currentOwner: player.currentTeam };
}

async function getRounds() {
  const settings = await Settings.get();
  await ensureRound(settings.currentRound);

  const [rounds, agg, poolSize] = await Promise.all([
    Round.find().sort({ number: 1 }),
    Auction.aggregate([
      { $match: { status: { $in: ['SOLD', 'UNSOLD'] } } },
      {
        $group: {
          _id: '$round',
          sold: { $sum: { $cond: [{ $eq: ['$status', 'SOLD'] }, 1, 0] } },
          unsold: { $sum: { $cond: [{ $eq: ['$status', 'UNSOLD'] }, 1, 0] } },
          amount: { $sum: { $ifNull: ['$finalBid', 0] } },
        },
      },
    ]),
    Player.countDocuments({ status: { $in: POOL_STATUSES } }),
  ]);

  const byRound = Object.fromEntries(agg.map((r) => [r._id, r]));
  const items = rounds.map((r) => {
    const s = byRound[r.number] || { sold: 0, unsold: 0, amount: 0 };
    const isCurrent = r.number === settings.currentRound;
    return {
      _id: r._id,
      number: r.number,
      status: r.status,
      startedAt: r.startedAt,
      closedAt: r.closedAt,
      players: isCurrent ? s.sold + s.unsold + poolSize : Math.max(r.playersAtStart, s.sold + s.unsold),
      sold: s.sold,
      unsold: s.unsold,
      remaining: isCurrent ? poolSize : 0,
      amount: s.amount,
      isCurrent,
    };
  });

  return { currentRound: settings.currentRound, rounds: items };
}

async function getPool() {
  const [pool, unsold, released] = await Promise.all([
    Player.find({ status: { $in: POOL_STATUSES } }).sort({ status: -1, name: 1 }),
    Player.find({ status: 'Unsold' }).sort({ name: 1 }),
    Player.find({ releaseCount: { $gt: 0 } }).sort({ lastReleasedAt: -1 }).populate('currentTeam', 'name logo color'),
  ]);
  return { pool, unsold, released };
}

module.exports = {
  getCurrentState,
  startAuction,
  nextPlayer,
  placeBid,
  markSold,
  markUnsold,
  cancelAuction,
  releasePlayer,
  startReAuction,
  getHistory,
  getPlayerHistory,
  getRounds,
  getPool,
  getRoundStats,
};
