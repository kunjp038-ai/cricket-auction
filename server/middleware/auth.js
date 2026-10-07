const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Admin = require('../models/Admin');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Not authenticated. Please login.');

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === 'TokenExpiredError' ? 'Session expired. Please login again.' : 'Invalid token.'
    );
  }

  const admin = await Admin.findById(decoded.id).select('-password');
  if (!admin || !admin.isActive) throw ApiError.unauthorized('Admin account not found or disabled.');

  req.admin = admin;
  next();
});

module.exports = { protect };
