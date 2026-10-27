/* eslint-disable no-console */
/**
 * Fresh start for the auction while keeping players, teams and settings.
 *
 *   node scripts/resetAuction.js            keeps Captain/Icon picks (default)
 *   node scripts/resetAuction.js --all      also clears Captain/Icon picks
 *
 * What it does:
 *  - every player (except kept Captain/Icon picks) -> Available, no team, no price
 *  - requires auction history (auctions/bids/ledger) to be empty; it never deletes records
 *  - each team's squad/budget is rebuilt from its kept picks; ledger entries + SOLD
 *    records (saleType CAPTAIN/ICON) are recreated for them so history stays consistent
 *  - round reset to 1 (OPEN), any pending auto-start cleared
 */
require('../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { Player, Team, Auction, Bid, Transaction, Round, Settings } = require('../models');

const clearAll = process.argv.includes('--all');

(async () => {
  await connectDB();
  const settings = await Settings.get();

  const keep = clearAll ? [] : await Player.find({ squadRole: { $in: ['Captain', 'Icon'] }, currentTeam: { $ne: null } });
  const keepIds = keep.map((p) => p._id);
  console.log(`Keeping ${keep.length} Captain/Icon pick(s)${clearAll ? ' (none, --all)' : ''}`);

  // 1. Auction history must already be empty (this script never deletes records).
  const [nA, nB, nT] = await Promise.all([
    Auction.countDocuments({}), Bid.countDocuments({}), Transaction.countDocuments({ type: { $ne: 'INITIAL_BUDGET' } }),
  ]);
  if (nA || nB || nT) {
    console.error(`Refusing: history not empty (auctions ${nA}, bids ${nB}, ledger entries ${nT}). Clear it first, then rerun.`);
    process.exit(2);
  }
  console.log('History is empty, continuing with updates only.');

  // 2. All other players back to the pool
  const res = await Player.updateMany(
    { _id: { $nin: keepIds } },
    { $set: { status: 'Available', currentTeam: null, soldPrice: 0, squadRole: '', auctionRound: 1, releaseCount: 0, lastReleasedAt: null } }
  );
  console.log(`Players made Available: ${res.modifiedCount}`);

  // 3. Rebuild each team from its kept picks
  const teams = await Team.find();
  const now = new Date();
  for (const team of teams) {
    const picks = keep.filter((p) => String(p.currentTeam) === String(team._id));
    let used = 0;
    team.players = [];
    for (const p of picks) {
      const price = p.squadRole === 'Captain' ? settings.captainPrice : settings.iconPrice;
      p.soldPrice = price;
      p.status = 'Sold';
      p.auctionRound = 1;
      await p.save();
      team.players.push(p._id);
      used += price;
      const auction = await Auction.create({
        player: p._id, round: 1, status: 'SOLD', saleType: p.squadRole === 'Captain' ? 'CAPTAIN' : 'ICON',
        basePrice: price, currentBid: price, bidCount: 0, finalBid: price, highestBidder: team._id, winningTeam: team._id,
        startedAt: now, completedAt: now,
      });
      await Transaction.create({
        team: team._id, player: p._id, auction: auction._id, type: 'PLAYER_PURCHASE', amount: -price,
        balanceAfter: team.totalBudget - used, round: 1,
        description: `${p.squadRole} pick: ${p.name} (fixed price ₹${price.toLocaleString('en-IN')})`,
      });
    }
    team.usedBudget = used;
    await team.save();
    console.log(`  ${team.name}: ${picks.length} pick(s), used ₹${used.toLocaleString('en-IN')}, remaining ₹${team.remainingBudget.toLocaleString('en-IN')}`);
  }

  // 4. Round 1, nothing pending
  const poolSize = await Player.countDocuments({ status: 'Available' });
  await Round.updateOne({ number: 1 }, { $set: { status: 'OPEN', playersAtStart: poolSize, closedAt: null, startedAt: new Date() } }, { upsert: true });
  settings.currentRound = 1;
  settings.pendingNextAt = null;
  await settings.save();

  console.log(`\nReady: Round 1, ${poolSize} players in the auction pool, ${await Player.countDocuments({ status: 'Sold' })} already in teams as Captain/Icon.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
