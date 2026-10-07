/* eslint-disable no-console */
/**
 * One-time migration: gives every player without a playerNo a sequential number
 * (continuing after the highest existing number, ordered by creation date).
 *   node scripts/assignPlayerNumbers.js
 */
require('../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { Player } = require('../models');

(async () => {
  await connectDB();
  const last = await Player.findOne({ playerNo: { $type: 'number' } }).sort({ playerNo: -1 }).select('playerNo');
  let next = last ? last.playerNo + 1 : 1;
  const missing = await Player.find({ $or: [{ playerNo: null }, { playerNo: { $exists: false } }] }).sort({ createdAt: 1, name: 1 });
  for (const p of missing) {
    p.playerNo = next++;
    await p.save();
    console.log(`#${p.playerNo}  ${p.name}`);
  }
  console.log(`${missing.length} player(s) numbered. Total players: ${await Player.countDocuments()}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
