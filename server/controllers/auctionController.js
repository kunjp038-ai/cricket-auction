const asyncHandler = require('../utils/asyncHandler');
const auctionService = require('../services/auctionService');

exports.current = asyncHandler(async (req, res) => {
  const state = await auctionService.getCurrentState();
  res.json({ success: true, ...state });
});

exports.start = asyncHandler(async (req, res) => {
  const { playerId } = req.body;
  const result = await auctionService.startAuction({ playerId, adminId: req.admin._id });
  res.status(201).json({ success: true, message: 'Auction started', ...result });
});

exports.bid = asyncHandler(async (req, res) => {
  const result = await auctionService.placeBid({ auctionId: req.params.id, teamId: req.body.teamId, adminId: req.admin._id });
  res.json({ success: true, message: 'Bid placed', ...result });
});

exports.sold = asyncHandler(async (req, res) => {
  const result = await auctionService.markSold({
    auctionId: req.params.id,
    adminId: req.admin._id,
    teamId: req.body.teamId,
    amount: req.body.amount,
  });
  res.json({
    success: true,
    message: `${result.player.name} SOLD to ${result.team.name} for ₹${result.finalBid.toLocaleString('en-IN')}`,
    auction: result.auction,
    player: result.player,
    team: result.team,
    state: result.state,
  });
});

exports.unsold = asyncHandler(async (req, res) => {
  const result = await auctionService.markUnsold({ auctionId: req.params.id, adminId: req.admin._id });
  res.json({ success: true, message: `${result.player.name} marked UNSOLD`, auction: result.auction, state: result.state });
});

exports.cancel = asyncHandler(async (req, res) => {
  const result = await auctionService.cancelAuction({ auctionId: req.params.id, adminId: req.admin._id });
  res.json({ success: true, message: 'Auction cancelled', auction: result.auction, state: result.state });
});

exports.next = asyncHandler(async (req, res) => {
  const result = await auctionService.nextPlayer({ adminId: req.admin._id });
  const message = result.poolEmpty
    ? 'No more players in the pool for this round.'
    : `${result.autoUnsold ? 'Previous player marked UNSOLD. ' : ''}Next player is up.`;
  res.json({ success: true, message, ...result });
});

exports.reauction = asyncHandler(async (req, res) => {
  const includeUnsold = req.body.includeUnsold !== false;
  const result = await auctionService.startReAuction({ includeUnsold, adminId: req.admin._id });
  res.json({
    success: true,
    message: `Round ${result.round.number} started with ${result.poolSize} players (${result.movedUnsold} unsold players moved to re-auction)`,
    ...result,
  });
});

exports.history = asyncHandler(async (req, res) => {
  const result = await auctionService.getHistory(req.query);
  res.json({ success: true, ...result });
});

exports.rounds = asyncHandler(async (req, res) => {
  const result = await auctionService.getRounds();
  res.json({ success: true, ...result });
});

exports.pool = asyncHandler(async (req, res) => {
  const result = await auctionService.getPool();
  res.json({ success: true, ...result });
});
