const { Player, Auction, Settings } = require('../models');
const ApiError = require('../utils/ApiError');
const { emitAuctionEvent } = require('../utils/socket');

const SORT_FIELDS = {
  playerNo: 'playerNo', name: 'name', basePrice: 'basePrice', status: 'status', createdAt: 'createdAt', playerType: 'playerType',
};

function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Next free player number (max + 1). */
async function nextPlayerNo() {
  const last = await Player.findOne({ playerNo: { $type: 'number' } }).sort({ playerNo: -1 }).select('playerNo');
  return last ? last.playerNo + 1 : 1;
}

async function assertPlayerNoFree(playerNo, excludeId) {
  const dup = await Player.findOne({ playerNo, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select('name');
  if (dup) throw ApiError.conflict(`Player number ${playerNo} is already used by ${dup.name}.`);
}

async function listPlayers(query = {}) {
  const filter = {};
  if (query.search) {
    const s = query.search.trim();
    const or = [{ name: new RegExp(escapeRegex(s), 'i') }];
    if (/^\d+$/.test(s)) or.push({ playerNo: Number(s) });
    filter.$or = or;
  }
  if (query.playerType) filter.playerType = query.playerType;
  if (query.battingStyle) filter.battingStyle = query.battingStyle;
  if (query.bowlingStyle) filter.bowlingStyle = query.bowlingStyle;
  if (query.status) filter.status = { $in: String(query.status).split(',') };
  if (query.team) filter.currentTeam = query.team;
  if (query.released === 'true') filter.releaseCount = { $gt: 0 };

  const sortField = SORT_FIELDS[query.sort] || 'playerNo';
  const sortDir = query.order === 'desc' ? -1 : 1;

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 500);

  const [items, total] = await Promise.all([
    Player.find(filter)
      .sort({ [sortField]: sortDir, name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('currentTeam', 'name logo color'),
    Player.countDocuments(filter),
  ]);

  return { items, total, page, pages: Math.ceil(total / limit), limit };
}

async function getPlayer(id) {
  const player = await Player.findById(id).populate('currentTeam', 'name logo color');
  if (!player) throw ApiError.notFound('Player not found');
  return player;
}

async function createPlayer(data) {
  const settings = await Settings.get();
  if (data.status && data.status === 'Sold') {
    throw ApiError.badRequest('A player cannot be created as Sold. Sell players through the auction.');
  }

  let playerNo = data.playerNo ? Number(data.playerNo) : null;
  if (playerNo) await assertPlayerNoFree(playerNo);
  else playerNo = await nextPlayerNo();

  const player = await Player.create({
    playerNo,
    name: data.name,
    phone: data.phone,
    playerType: data.playerType,
    battingStyle: data.battingStyle,
    bowlingStyle: data.bowlingStyle || 'None',
    tshirtSize: data.tshirtSize || 'M',
    address: data.address || '',
    photo: data.photo || '',
    basePrice: data.basePrice || settings.getRoundConfig(settings.currentRound).basePrice,
    status: data.status || 'Available',
    auctionRound: settings.currentRound,
  });
  emitAuctionEvent('players:updated', { message: `Player #${player.playerNo} ${player.name} added` });
  return player;
}

async function updatePlayer(id, data) {
  const player = await Player.findById(id);
  if (!player) throw ApiError.notFound('Player not found');

  const live = await Auction.findOne({ status: 'LIVE', player: player._id });

  if (data.status !== undefined && data.status !== player.status) {
    if (data.status === 'Sold') {
      throw ApiError.badRequest('Status cannot be set to Sold manually. Use the auction SOLD action.');
    }
    if (player.status === 'Sold') {
      throw ApiError.badRequest('This player belongs to a team. Release the player to change the status.');
    }
    if (live) throw ApiError.badRequest('Player is currently being auctioned. Finish the auction first.');
    player.status = data.status;
  }

  if (data.playerNo !== undefined && Number(data.playerNo) !== player.playerNo) {
    const n = Number(data.playerNo);
    if (!n) throw ApiError.badRequest('Player number is required.');
    await assertPlayerNoFree(n, player._id);
    player.playerNo = n;
  }

  if (data.basePrice !== undefined) player.basePrice = data.basePrice;

  ['name', 'phone', 'playerType', 'battingStyle', 'bowlingStyle', 'tshirtSize', 'address', 'photo'].forEach((f) => {
    if (data[f] !== undefined) player[f] = data[f];
  });

  await player.save();
  emitAuctionEvent('players:updated', { message: `Player ${player.name} updated` });
  return getPlayer(player._id);
}

async function deletePlayer(id) {
  const player = await Player.findById(id);
  if (!player) throw ApiError.notFound('Player not found');
  if (player.status === 'Sold' || player.currentTeam) {
    throw ApiError.badRequest('Player belongs to a team. Release the player before deleting.');
  }
  const history = await Auction.countDocuments({ player: player._id, status: { $ne: 'CANCELLED' } });
  if (history > 0) {
    throw ApiError.badRequest('Player has auction history and cannot be deleted. The auction record must be preserved.');
  }
  await Auction.deleteMany({ player: player._id, status: 'CANCELLED' });
  await Player.deleteOne({ _id: player._id });
  emitAuctionEvent('players:updated', { message: `Player ${player.name} deleted` });
  return player;
}

module.exports = { listPlayers, getPlayer, createPlayer, updatePlayer, deletePlayer, nextPlayerNo };
