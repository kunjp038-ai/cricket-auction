const asyncHandler = require('../utils/asyncHandler');
const playerService = require('../services/playerService');
const auctionService = require('../services/auctionService');
const { PLAYER_TYPES, BATTING_STYLES, BOWLING_STYLES, TSHIRT_SIZES, PLAYER_STATUS } = require('../models/Player');

exports.meta = (req, res) => {
  res.json({
    success: true,
    playerTypes: PLAYER_TYPES,
    battingStyles: BATTING_STYLES,
    bowlingStyles: BOWLING_STYLES,
    tshirtSizes: TSHIRT_SIZES,
    statuses: PLAYER_STATUS,
  });
};

exports.list = asyncHandler(async (req, res) => {
  const result = await playerService.listPlayers(req.query);
  res.json({ success: true, ...result });
});

exports.get = asyncHandler(async (req, res) => {
  const player = await playerService.getPlayer(req.params.id);
  res.json({ success: true, player });
});

exports.create = asyncHandler(async (req, res) => {
  const player = await playerService.createPlayer(req.body);
  res.status(201).json({ success: true, player, message: 'Player created' });
});

exports.update = asyncHandler(async (req, res) => {
  const player = await playerService.updatePlayer(req.params.id, req.body);
  res.json({ success: true, player, message: 'Player updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  await playerService.deletePlayer(req.params.id);
  res.json({ success: true, message: 'Player deleted' });
});

exports.release = asyncHandler(async (req, res) => {
  const result = await auctionService.releasePlayer({ playerId: req.params.id, adminId: req.admin._id });
  res.json({
    success: true,
    message: `${result.player.name} released from ${result.team.name}. Refunded ₹${result.refund.toLocaleString('en-IN')}.`,
    player: result.player,
    team: result.team,
    refund: result.refund,
  });
});

exports.history = asyncHandler(async (req, res) => {
  const result = await auctionService.getPlayerHistory(req.params.id);
  res.json({ success: true, ...result });
});
