const asyncHandler = require('../utils/asyncHandler');
const { Settings } = require('../models');
const ApiError = require('../utils/ApiError');
const { emitAuctionEvent } = require('../utils/socket');

exports.get = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  res.json({ success: true, settings });
});

exports.update = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const fields = ['auctionName', 'bidIncrement', 'minBid', 'maxBid', 'defaultBasePrice', 'allowPreviousTeamRebid'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) settings[f] = req.body[f];
  });
  if (settings.maxBid > 0 && settings.maxBid < settings.minBid) {
    throw ApiError.badRequest('Maximum bid cannot be lower than the minimum bid.');
  }
  await settings.save();
  emitAuctionEvent('settings:updated', { settings, message: 'Auction settings updated' });
  res.json({ success: true, settings, message: 'Settings saved' });
});
