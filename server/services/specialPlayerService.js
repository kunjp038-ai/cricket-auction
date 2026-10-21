const { Team, Player, Auction, Transaction, Settings } = require('../models');
const { POOL_STATUSES } = require('../models/Player');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { emitAuctionEvent } = require('../utils/socket');
const { formatINR } = require('../utils/format');

/**
 * Captain & Icon: every team gets two players before the auction at fixed prices
 * (Settings.captainPrice / Settings.iconPrice). They are recorded exactly like a sale
 * (Auction record with saleType CAPTAIN/ICON + PLAYER_PURCHASE ledger entry), so budgets,
 * squads and history stay consistent. The remaining players are bought through bidding.
 */
const ROLES = { Captain: { key: 'captainPrice', saleType: 'CAPTAIN' }, Icon: { key: 'iconPrice', saleType: 'ICON' } };
const sessionOpts = (session) => (session ? { session } : {});

function roleConfig(role) {
  const cfg = ROLES[role];
  if (!cfg) throw ApiError.badRequest('Role must be Captain or Icon.');
  return cfg;
}

async function assignSpecialPlayer({ teamId, playerId, role, adminId }) {
  const cfg = roleConfig(role);

  const result = await runInTransaction(async (session) => {
    const [team, player, settings] = await Promise.all([
      Team.findById(teamId).session(session),
      Player.findById(playerId).session(session),
      Settings.get(session),
    ]);
    if (!team) throw ApiError.notFound('Team not found');
    if (!player) throw ApiError.notFound('Player not found');

    if (player.currentTeam || player.status === 'Sold') {
      throw ApiError.badRequest(`${player.name} already belongs to a team.`);
    }
    if (![...POOL_STATUSES, 'Unsold'].includes(player.status)) {
      throw ApiError.badRequest(`${player.name} is "${player.status}" and cannot be assigned.`);
    }
    const live = await Auction.findOne({ status: 'LIVE', player: player._id }).session(session);
    if (live) throw ApiError.badRequest(`${player.name} is on the auction block right now.`);

    const existing = await Player.findOne({ currentTeam: team._id, squadRole: role }).session(session);
    if (existing) throw ApiError.badRequest(`${team.name} already has an ${role === 'Icon' ? 'Icon' : 'Captain'} player (${existing.name}). Remove it first.`);

    if (team.players.length >= team.maxPlayers) {
      throw ApiError.badRequest(`${team.name} has reached its maximum squad size (${team.maxPlayers}).`);
    }
    const price = settings[cfg.key] || 0;
    if (price > team.remainingBudget) throw ApiError.badRequest('Insufficient budget for this player.');

    const now = new Date();
    const [auction] = await Auction.create(
      [{
        player: player._id,
        round: settings.currentRound,
        status: 'SOLD',
        saleType: cfg.saleType,
        basePrice: price,
        currentBid: price,
        bidCount: 0,
        finalBid: price,
        highestBidder: team._id,
        winningTeam: team._id,
        startedAt: now,
        completedAt: now,
        conductedBy: adminId || null,
      }],
      sessionOpts(session)
    );

    player.status = 'Sold';
    player.currentTeam = team._id;
    player.soldPrice = price;
    player.squadRole = role;
    player.auctionRound = settings.currentRound;
    await player.save(sessionOpts(session));

    team.usedBudget += price;
    team.players.push(player._id);
    await team.save(sessionOpts(session));

    await Transaction.create(
      [{
        team: team._id,
        player: player._id,
        auction: auction._id,
        type: 'PLAYER_PURCHASE',
        amount: -price,
        balanceAfter: team.remainingBudget,
        round: settings.currentRound,
        description: `${role} pick: ${player.name} (fixed price ${formatINR(price)})`,
        createdBy: adminId || null,
      }],
      sessionOpts(session)
    );

    return { team, player, price };
  });

  emitAuctionEvent('teams:updated', { message: `${result.player.name} is ${result.team.name}'s ${role}` });
  return { ...result, message: `${result.player.name} assigned as ${role} of ${result.team.name} (${formatINR(result.price)})` };
}

/** Undo a Captain/Icon pick (e.g. wrong player chosen): refund and return the player to the pool. */
async function removeSpecialPlayer({ teamId, role, adminId }) {
  roleConfig(role);

  const result = await runInTransaction(async (session) => {
    const team = await Team.findById(teamId).session(session);
    if (!team) throw ApiError.notFound('Team not found');
    const player = await Player.findOne({ currentTeam: team._id, squadRole: role }).session(session);
    if (!player) throw ApiError.badRequest(`${team.name} has no ${role} player.`);

    const sale = await Auction.findOne({
      player: player._id, winningTeam: team._id, status: 'SOLD', saleType: ROLES[role].saleType, releasedAt: null,
    }).sort({ completedAt: -1 }).session(session);
    const refund = sale ? sale.finalBid : player.soldPrice;

    team.players = team.players.filter((id) => !id.equals(player._id));
    team.usedBudget = Math.max(0, team.usedBudget - refund);
    await team.save(sessionOpts(session));

    if (sale) {
      sale.releasedAt = new Date();
      await sale.save(sessionOpts(session));
    }

    player.status = 'Available';
    player.currentTeam = null;
    player.soldPrice = 0;
    player.squadRole = '';
    await player.save(sessionOpts(session));

    await Transaction.create(
      [{
        team: team._id,
        player: player._id,
        auction: sale ? sale._id : null,
        type: 'PLAYER_RELEASE',
        amount: refund,
        balanceAfter: team.remainingBudget,
        round: sale ? sale.round : null,
        description: `${role} pick removed: ${player.name} (refund ${formatINR(refund)})`,
        createdBy: adminId || null,
      }],
      sessionOpts(session)
    );

    return { team, player, refund };
  });

  emitAuctionEvent('teams:updated', { message: `${result.player.name} removed as ${role} of ${result.team.name}` });
  return { ...result, message: `${result.player.name} removed as ${role}. ${formatINR(result.refund)} refunded and player is back in the pool.` };
}

module.exports = { assignSpecialPlayer, removeSpecialPlayer };
