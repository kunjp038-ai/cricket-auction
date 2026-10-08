const asyncHandler = require('../utils/asyncHandler');
const { Settings } = require('../models');
const ApiError = require('../utils/ApiError');
const { emitAuctionEvent } = require('../utils/socket');

exports.get = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  res.json({ success: true, settings, roundConfig: settings.getRoundConfig(settings.currentRound) });
});

exports.update = asyncHandler(async (req, res) => {
  const settings = await Settings.get();
  const fields = [
    'auctionName', 'bidIncrement', 'bidIncrement2', 'minBid', 'maxBid', 'defaultBasePrice', 'defaultTimerSeconds',
    'allowPreviousTeamRebid', 'autoNextPlayer', 'auctionOrder',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) settings[f] = req.body[f];
  });

  if (req.body.sounds && typeof req.body.sounds === 'object') {
    ['countdown', 'timeUp', 'sold', 'unsold', 'start'].forEach((k) => {
      if (req.body.sounds[k] !== undefined) settings.sounds[k] = String(req.body.sounds[k] || '').trim();
    });
  }

  if (req.body.roundConfigs !== undefined) {
    const rounds = new Set();
    const cleaned = [];
    for (const c of req.body.roundConfigs) {
      if (rounds.has(c.round)) throw ApiError.badRequest(`Round ${c.round} is listed more than once.`);
      rounds.add(c.round);
      cleaned.push({ round: c.round, basePrice: c.basePrice, timerSeconds: c.timerSeconds ?? settings.defaultTimerSeconds });
    }
    settings.roundConfigs = cleaned.sort((a, b) => a.round - b.round);
  }

  if (settings.maxBid > 0) {
    const tooHigh = settings.roundConfigs.find((c) => c.basePrice > settings.maxBid);
    if (tooHigh) throw ApiError.badRequest(`Round ${tooHigh.round} base price is higher than the maximum bid.`);
  }

  await settings.save();
  emitAuctionEvent('settings:updated', { settings, message: 'Auction settings updated' });
  res.json({ success: true, settings, roundConfig: settings.getRoundConfig(settings.currentRound), message: 'Settings saved' });
});
