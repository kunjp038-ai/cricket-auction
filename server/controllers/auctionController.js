const asyncHandler = require('../utils/asyncHandler');
const auctionService = require('../services/auctionService');

/**
 * GET /auctions/version?since=<v>
 * Returns the current change stamp; when it differs from `since` the full state is included,
 * so a polling screen needs only one request per tick.
 */
exports.version = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  await auctionService.runDueAutoStart();
  const version = await auctionService.getVersion();
  const since = req.query.since;
  if (since !== undefined && since === version) {
    return res.json({ success: true, version, changed: false, serverTime: new Date() });
  }
  const state = await auctionService.getCurrentState();
  res.json({ success: true, version: state.version || version, changed: true, state, serverTime: new Date() });
});

exports.current = asyncHandler(async (req, res) => {
  await auctionService.runDueAutoStart();
  const state = await auctionService.getCurrentState();
  res.json({ success: true, ...state });
});

exports.start = asyncHandler(async (req, res) => {
  const { playerId } = req.body;
  const result = await auctionService.startAuction({ playerId, adminId: req.admin._id });
  res.status(201).json({ success: true, message: 'Auction started', ...result });
});

exports.bid = asyncHandler(async (req, res) => {
  const result = await auctionService.placeBid({
    auctionId: req.params.id, teamId: req.body.teamId, increment: req.body.increment, amount: req.body.amount, adminId: req.admin._id,
  });
  res.json({ success: true, message: result.message, ...result });
});

exports.undoBid = asyncHandler(async (req, res) => {
  const result = await auctionService.undoLastBid({ auctionId: req.params.id });
  res.json({ success: true, ...result });
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
    message: `${result.player.name} SOLD to ${result.team.name} for ₹${result.finalBid.toLocaleString('en-IN')}${result.autoStarted ? ' · next player is up' : result.nextPlayerAt ? ' · next player in a moment' : ''}`,
    auction: result.auction,
    player: result.player,
    team: result.team,
    state: result.state,
    autoStarted: result.autoStarted,
    nextPlayerAt: result.nextPlayerAt || null,
  });
});

exports.unsold = asyncHandler(async (req, res) => {
  const result = await auctionService.markUnsold({ auctionId: req.params.id, adminId: req.admin._id });
  res.json({
    success: true,
    message: `${result.player.name} marked UNSOLD${result.autoStarted ? ' · next player is up' : result.nextPlayerAt ? ' · next player in a moment' : ''}`,
    auction: result.auction,
    state: result.state,
    autoStarted: result.autoStarted,
    nextPlayerAt: result.nextPlayerAt || null,
  });
});

exports.resetTimer = asyncHandler(async (req, res) => {
  const result = await auctionService.resetTimer({ auctionId: req.params.id, seconds: req.body.seconds });
  res.json({ success: true, message: 'Timer restarted', auction: result.auction, state: result.state });
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
