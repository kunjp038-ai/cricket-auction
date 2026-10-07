const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Admin } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (admin) => jwt.sign({ id: admin._id, role: admin.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const publicAdmin = (a) => ({ id: a._id, name: a.name, email: a.email, role: a.role, lastLoginAt: a.lastLoginAt });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await Admin.findOne({ email }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password.');
  }
  if (!admin.isActive) throw ApiError.forbidden('This admin account is disabled.');

  admin.lastLoginAt = new Date();
  await admin.save();

  res.json({ success: true, token: signToken(admin), admin: publicAdmin(admin) });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, admin: publicAdmin(req.admin) });
});

/** Creates the very first admin. Only works while no admin exists (first-run bootstrap). */
exports.setup = asyncHandler(async (req, res) => {
  const count = await Admin.countDocuments();
  if (count > 0) throw ApiError.forbidden('Setup already completed. Please login.');
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    throw ApiError.badRequest('name, email and a password of at least 6 characters are required.');
  }
  const admin = await Admin.create({ name, email, password });
  res.status(201).json({ success: true, token: signToken(admin), admin: publicAdmin(admin) });
});

exports.setupStatus = asyncHandler(async (req, res) => {
  const count = await Admin.countDocuments();
  res.json({ success: true, needsSetup: count === 0 });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    throw ApiError.badRequest('Current password and a new password of at least 6 characters are required.');
  }
  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!(await admin.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect.');
  admin.password = newPassword;
  await admin.save();
  res.json({ success: true, message: 'Password updated.' });
});
