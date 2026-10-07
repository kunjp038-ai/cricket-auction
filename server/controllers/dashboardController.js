const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboardService');

exports.admin = asyncHandler(async (req, res) => {
  const data = await dashboardService.getAdminDashboard();
  res.json({ success: true, ...data });
});
