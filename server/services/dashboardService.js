const { Player, Team, Auction, Settings } = require('../models');
const { POOL_STATUSES } = require('../models/Player');

async function getAdminDashboard() {
  const settings = await Settings.get();

  const [
    totalPlayers, available, sold, unsold, released, reAuction, totalTeams,
    spendAgg, liveAuction, recentSales, teams, poolSize,
  ] = await Promise.all([
    Player.countDocuments(),
    Player.countDocuments({ status: 'Available' }),
    Player.countDocuments({ status: 'Sold' }),
    Player.countDocuments({ status: 'Unsold' }),
    Player.countDocuments({ releaseCount: { $gt: 0 } }),
    Player.countDocuments({ status: 'Re-Auction' }),
    Team.countDocuments(),
    Team.aggregate([{ $group: { _id: null, used: { $sum: '$usedBudget' }, total: { $sum: '$totalBudget' } } }]),
    Auction.findOne({ status: 'LIVE' }).populate('player', 'name photo playerType').populate('highestBidder', 'name'),
    Auction.find({ status: 'SOLD' })
      .sort({ completedAt: -1 })
      .limit(6)
      .populate('player', 'name photo playerType')
      .populate('winningTeam', 'name logo color'),
    Team.find().sort({ name: 1 }).select('name logo color totalBudget usedBudget remainingBudget players maxPlayers'),
    Player.countDocuments({ status: { $in: POOL_STATUSES } }),
  ]);

  return {
    kpis: {
      totalPlayers,
      availablePlayers: available,
      soldPlayers: sold,
      unsoldPlayers: unsold,
      releasedPlayers: released,
      reAuctionPlayers: reAuction,
      totalTeams,
      totalAuctionAmount: spendAgg[0] ? spendAgg[0].used : 0,
      totalBudgetPool: spendAgg[0] ? spendAgg[0].total : 0,
      currentRound: settings.currentRound,
      poolSize,
    },
    liveAuction,
    recentSales,
    teams,
    settings,
  };
}

module.exports = { getAdminDashboard };
