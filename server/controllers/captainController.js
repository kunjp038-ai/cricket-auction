const asyncHandler = require('../utils/asyncHandler');
const captainService = require('../services/captainService');

exports.list = asyncHandler(async (req, res) => {
  const captains = await captainService.listCaptains();
  res.json({ success: true, captains });
});

exports.get = asyncHandler(async (req, res) => {
  const captain = await captainService.getCaptain(req.params.id);
  res.json({ success: true, captain });
});

exports.create = asyncHandler(async (req, res) => {
  const captain = await captainService.createCaptain(req.body);
  res.status(201).json({ success: true, captain, message: 'Captain created' });
});

exports.update = asyncHandler(async (req, res) => {
  const captain = await captainService.updateCaptain(req.params.id, req.body);
  res.json({ success: true, captain, message: 'Captain updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  await captainService.deleteCaptain(req.params.id);
  res.json({ success: true, message: 'Captain deleted' });
});
