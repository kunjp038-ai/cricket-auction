/* eslint-disable no-console */
/**
 * Imports players from a JSON file (one entry per registration-form page).
 *
 *   node scripts/importPlayers.js [path/to/players.json] [--reset]
 *
 * Each entry: { playerNo, name, phone, playerType, battingStyle, bowlingStyle, address, photo, captain, notes }
 * Players are upserted by playerNo (existing numbers are updated, new ones created).
 *
 * --reset  wipes ALL players and auction history (auctions, bids, rounds, non-initial
 *          transactions), resets every team's budget/squad and the current round to 1,
 *          then imports. Teams, captains and settings are kept.
 */
require('../config/env');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { Player, Team, Auction, Bid, Transaction, Round, Settings } = require('../models');
const { PHONE_REGEX } = require('../utils/format');

const args = process.argv.slice(2);
const reset = args.includes('--reset');
const file = args.find((a) => !a.startsWith('--')) || path.join(__dirname, 'data', 'ppl-2025-players.json');

(async () => {
  await connectDB();
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Loaded ${data.length} players from ${file}`);

  const settings = await Settings.get();

  if (reset) {
    console.log('Resetting players and auction history...');
    await Promise.all([Player.deleteMany({}), Auction.deleteMany({}), Bid.deleteMany({}), Round.deleteMany({})]);
    await Transaction.deleteMany({ type: { $ne: 'INITIAL_BUDGET' } });
    const teams = await Team.find();
    for (const t of teams) {
      t.usedBudget = 0;
      t.players = [];
      await t.save();
    }
    settings.currentRound = 1;
    await settings.save();
    await Round.create({ number: 1, playersAtStart: data.length });
    console.log(`Teams reset: ${teams.length}. Round set to 1.`);
  }

  const basePrice = settings.getRoundConfig(settings.currentRound).basePrice;
  let created = 0;
  let updated = 0;
  const warnings = [];

  for (const p of data) {
    let phone = String(p.phone || '').replace(/\D/g, '');
    if (!PHONE_REGEX.test(phone)) {
      warnings.push(`#${p.playerNo} ${p.name}: phone "${p.phone || ''}" not readable -> placeholder`);
      phone = '0000000000';
    }
    const doc = {
      playerNo: p.playerNo,
      name: p.name,
      phone,
      playerType: p.playerType || 'Batsman',
      battingStyle: p.battingStyle || 'Right Hand',
      bowlingStyle: p.bowlingStyle || 'None',
      tshirtSize: p.tshirtSize || 'M',
      address: [p.address, p.captain ? 'Captain (as per form)' : '', p.notes].filter(Boolean).join(' · '),
      photo: p.photo || '',
      basePrice,
    };
    const existing = await Player.findOne({ playerNo: p.playerNo });
    if (existing) {
      Object.assign(existing, doc);
      await existing.save();
      updated += 1;
    } else {
      await Player.create({ ...doc, status: 'Available', auctionRound: settings.currentRound });
      created += 1;
    }
  }

  console.log(`Done. Created ${created}, updated ${updated}. Total players: ${await Player.countDocuments()}`);
  if (warnings.length) {
    console.log('\nCheck these manually:');
    warnings.forEach((w) => console.log('  - ' + w));
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
