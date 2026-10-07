const { Team, Captain, Player, Auction, Transaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { emitAuctionEvent } = require('../utils/socket');
const { formatINR } = require('../utils/format');

const sessionOpts = (session) => (session ? { session } : {});

/**
 * Assigns (or removes, when captainId is null) a captain to a team.
 * Guarantees one captain per team and one team per captain.
 */
async function assignCaptain(teamId, captainId, session) {
  const team = await Team.findById(teamId).session(session || null);
  if (!team) throw ApiError.notFound('Team not found');

  // Remove current captain
  if (!captainId) {
    if (team.captain) {
      await Captain.updateOne({ _id: team.captain }, { $set: { team: null } }).session(session || null);
      team.captain = null;
      await team.save(sessionOpts(session));
    }
    return team;
  }

  const captain = await Captain.findById(captainId).session(session || null);
  if (!captain) throw ApiError.notFound('Captain not found');

  // Captain leaves their old team (if any)
  if (captain.team && !captain.team.equals(team._id)) {
    await Team.updateOne({ _id: captain.team }, { $set: { captain: null } }).session(session || null);
  }
  // Team's old captain is unassigned
  if (team.captain && !team.captain.equals(captain._id)) {
    await Captain.updateOne({ _id: team.captain }, { $set: { team: null } }).session(session || null);
  }

  captain.team = team._id;
  await captain.save(sessionOpts(session));
  team.captain = captain._id;
  await team.save(sessionOpts(session));
  return team;
}

async function listTeams() {
  return Team.find().sort({ name: 1 }).populate('captain', 'name phone photo');
}

async function getTeam(id) {
  const team = await Team.findById(id)
    .populate('captain', 'name phone photo')
    .populate('players', 'name playerType battingStyle bowlingStyle photo soldPrice status basePrice');
  if (!team) throw ApiError.notFound('Team not found');
  return team;
}

async function createTeam(data, adminId) {
  const exists = await Team.findOne({ name: new RegExp(`^${escapeRegex(data.name)}$`, 'i') });
  if (exists) throw ApiError.conflict(`A team named "${data.name}" already exists.`);

  const team = await runInTransaction(async (session) => {
    const [created] = await Team.create(
      [{
        name: data.name,
        logo: data.logo || '',
        color: data.color || '#1f6feb',
        totalBudget: data.totalBudget,
        usedBudget: 0,
        maxPlayers: data.maxPlayers || 15,
        minPlayers: data.minPlayers ?? 11,
        players: [],
      }],
      sessionOpts(session)
    );

    await Transaction.create(
      [{
        team: created._id,
        type: 'INITIAL_BUDGET',
        amount: created.totalBudget,
        balanceAfter: created.remainingBudget,
        description: `Initial budget ${formatINR(created.totalBudget)}`,
        createdBy: adminId || null,
      }],
      sessionOpts(session)
    );

    if (data.captain) await assignCaptain(created._id, data.captain, session);
    return created;
  });

  emitAuctionEvent('teams:updated', { message: `Team ${team.name} created` });
  return getTeam(team._id);
}

async function updateTeam(id, data, adminId) {
  const team = await runInTransaction(async (session) => {
    const doc = await Team.findById(id).session(session);
    if (!doc) throw ApiError.notFound('Team not found');

    if (data.name && data.name !== doc.name) {
      const dup = await Team.findOne({ _id: { $ne: doc._id }, name: new RegExp(`^${escapeRegex(data.name)}$`, 'i') }).session(session);
      if (dup) throw ApiError.conflict(`A team named "${data.name}" already exists.`);
      doc.name = data.name;
    }
    if (data.logo !== undefined) doc.logo = data.logo || '';
    if (data.color !== undefined) doc.color = data.color || doc.color;
    if (data.maxPlayers !== undefined) {
      if (data.maxPlayers < doc.players.length) {
        throw ApiError.badRequest(`Max players cannot be lower than the current squad size (${doc.players.length}).`);
      }
      doc.maxPlayers = data.maxPlayers;
    }
    if (data.minPlayers !== undefined) doc.minPlayers = data.minPlayers;

    // Budget changes are recorded as BUDGET_ADJUSTMENT ledger entries.
    if (data.totalBudget !== undefined && data.totalBudget !== doc.totalBudget) {
      const delta = data.totalBudget - doc.totalBudget;
      if (data.totalBudget < doc.usedBudget) {
        throw ApiError.badRequest(
          `Total budget cannot be lower than the amount already used (${formatINR(doc.usedBudget)}).`
        );
      }
      doc.totalBudget = data.totalBudget;
      await doc.save({ session });
      await Transaction.create(
        [{
          team: doc._id,
          type: 'BUDGET_ADJUSTMENT',
          amount: delta,
          balanceAfter: doc.remainingBudget,
          description: `Budget adjusted by ${delta >= 0 ? '+' : '-'}${formatINR(Math.abs(delta))} (new total ${formatINR(doc.totalBudget)})`,
          createdBy: adminId || null,
        }],
        sessionOpts(session)
      );
    } else {
      await doc.save({ session });
    }

    if (data.captain !== undefined) await assignCaptain(doc._id, data.captain || null, session);
    return doc;
  });

  emitAuctionEvent('teams:updated', { message: `Team ${team.name} updated` });
  return getTeam(team._id);
}

async function deleteTeam(id) {
  const team = await Team.findById(id);
  if (!team) throw ApiError.notFound('Team not found');
  if (team.players.length > 0) {
    throw ApiError.badRequest('Team still owns players. Release all players before deleting the team.');
  }
  const live = await Auction.findOne({ status: 'LIVE', highestBidder: team._id });
  if (live) throw ApiError.badRequest('Team is the highest bidder in the live auction and cannot be deleted.');

  await runInTransaction(async (session) => {
    await Captain.updateMany({ team: team._id }, { $set: { team: null } }).session(session);
    await Transaction.deleteMany({ team: team._id }).session(session);
    await Team.deleteOne({ _id: team._id }).session(session);
  });
  emitAuctionEvent('teams:updated', { message: `Team ${team.name} deleted` });
  return team;
}

async function getDashboard(id) {
  const team = await Team.findById(id)
    .populate('captain', 'name phone photo')
    .populate('players', 'name playerType battingStyle bowlingStyle tshirtSize photo soldPrice status basePrice auctionRound');
  if (!team) throw ApiError.notFound('Team not found');

  const [activeSales, releasedSales, ledger] = await Promise.all([
    Auction.find({ winningTeam: team._id, status: 'SOLD', releasedAt: null }).select('player finalBid round completedAt'),
    Auction.find({ winningTeam: team._id, status: 'SOLD', releasedAt: { $ne: null } })
      .sort({ releasedAt: -1 })
      .populate('player', 'name playerType photo status currentTeam'),
    Transaction.find({ team: team._id }).sort({ createdAt: 1 }).populate('player', 'name'),
  ]);

  const saleByPlayer = Object.fromEntries(activeSales.map((a) => [String(a.player), a]));
  const squad = team.players.map((p) => {
    const sale = saleByPlayer[String(p._id)];
    return {
      _id: p._id,
      name: p.name,
      playerType: p.playerType,
      battingStyle: p.battingStyle,
      bowlingStyle: p.bowlingStyle,
      tshirtSize: p.tshirtSize,
      photo: p.photo,
      basePrice: p.basePrice,
      bidAmount: sale ? sale.finalBid : p.soldPrice,
      round: sale ? sale.round : p.auctionRound,
      boughtAt: sale ? sale.completedAt : null,
      status: 'Active',
    };
  });

  const countType = (type) => squad.filter((p) => p.playerType === type).length;
  const stats = {
    totalPlayers: squad.length,
    batsmen: countType('Batsman'),
    bowlers: countType('Bowler'),
    allRounders: countType('All-Rounder'),
    wicketKeepers: countType('Wicket Keeper'),
    totalSpent: team.usedBudget,
    remainingBudget: team.remainingBudget,
    totalBudget: team.totalBudget,
    maxPlayers: team.maxPlayers,
    minPlayers: team.minPlayers,
    slotsLeft: Math.max(team.maxPlayers - squad.length, 0),
    budgetUsedPct: team.totalBudget ? Math.round((team.usedBudget / team.totalBudget) * 100) : 0,
  };

  // Ledger-derived balance: proves the team budget is never calculated from the player list alone.
  const ledgerBalance = ledger.reduce((sum, t) => sum + t.amount, 0);

  return { team, squad, stats, ledger, ledgerBalance, releasedHistory: releasedSales };
}

function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { listTeams, getTeam, createTeam, updateTeam, deleteTeam, assignCaptain, getDashboard };
