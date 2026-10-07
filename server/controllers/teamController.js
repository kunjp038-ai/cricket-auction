const asyncHandler = require('../utils/asyncHandler');
const teamService = require('../services/teamService');

exports.list = asyncHandler(async (req, res) => {
  const teams = await teamService.listTeams();
  res.json({ success: true, teams });
});

exports.get = asyncHandler(async (req, res) => {
  const team = await teamService.getTeam(req.params.id);
  res.json({ success: true, team });
});

exports.create = asyncHandler(async (req, res) => {
  const team = await teamService.createTeam(req.body, req.admin._id);
  res.status(201).json({ success: true, team, message: 'Team created' });
});

exports.update = asyncHandler(async (req, res) => {
  const team = await teamService.updateTeam(req.params.id, req.body, req.admin._id);
  res.json({ success: true, team, message: 'Team updated' });
});

exports.remove = asyncHandler(async (req, res) => {
  await teamService.deleteTeam(req.params.id);
  res.json({ success: true, message: 'Team deleted' });
});

exports.assignCaptain = asyncHandler(async (req, res) => {
  await teamService.assignCaptain(req.params.id, req.body.captainId || null);
  const team = await teamService.getTeam(req.params.id);
  res.json({ success: true, team, message: req.body.captainId ? 'Captain assigned' : 'Captain removed' });
});

exports.dashboard = asyncHandler(async (req, res) => {
  const data = await teamService.getDashboard(req.params.id);
  res.json({ success: true, ...data });
});
