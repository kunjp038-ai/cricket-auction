/* eslint-disable no-console */
/**
 * Seeds the database with an admin, auction settings, 4 teams + captains and 20 players.
 *   npm run seed            -> adds data (keeps existing documents, skips duplicates)
 *   npm run seed -- --fresh -> wipes ALL auction data first (players, teams, captains, auctions, bids, transactions, rounds)
 */
const env = require('../config/env');
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const { Admin, Player, Team, Captain, Auction, Bid, Transaction, Round, Settings } = require('../models');

const fresh = process.argv.includes('--fresh');

const TEAMS = [
  { name: 'Royal Strikers', color: '#d62828', totalBudget: 50000, captain: { name: 'Rohan Desai', phone: '9876500001' } },
  { name: 'Thunder Kings', color: '#1d4ed8', totalBudget: 50000, captain: { name: 'Amit Shah', phone: '9876500002' } },
  { name: 'Green Warriors', color: '#15803d', totalBudget: 50000, captain: { name: 'Kiran Mehta', phone: '9876500003' } },
  { name: 'Golden Eagles', color: '#ca8a04', totalBudget: 50000, captain: { name: 'Sanjay Rao', phone: '9876500004' } },
];

const PLAYERS = [
  ['Virat Patel', 'Batsman', 'Right Hand', 'None', 'L', 2000],
  ['Rahul Patel', 'Batsman', 'Left Hand', 'None', 'M', 2500],
  ['Jay Shah', 'Bowler', 'Right Hand', 'Right Arm', 'L', 2000],
  ['Harsh Trivedi', 'Bowler', 'Right Hand', 'Left Arm', 'XL', 1500],
  ['Dev Joshi', 'All-Rounder', 'Right Hand', 'Right Arm', 'M', 3000],
  ['Parth Mehta', 'Wicket Keeper', 'Right Hand', 'None', 'M', 2000],
  ['Kunal Vyas', 'Batsman', 'Right Hand', 'Right Arm', 'S', 1500],
  ['Nikhil Rana', 'Bowler', 'Left Hand', 'Left Arm', 'L', 2000],
  ['Mihir Dave', 'All-Rounder', 'Left Hand', 'Right Arm', 'XL', 3500],
  ['Yash Bhatt', 'Wicket Keeper', 'Left Hand', 'None', 'M', 1500],
  ['Aakash Pandya', 'Batsman', 'Right Hand', 'None', 'L', 2000],
  ['Ravi Solanki', 'Bowler', 'Right Hand', 'Right Arm', 'M', 1500],
  ['Sagar Chauhan', 'All-Rounder', 'Right Hand', 'Left Arm', 'L', 2500],
  ['Tejas Gohil', 'Batsman', 'Left Hand', 'None', 'XXL', 2000],
  ['Umang Parikh', 'Bowler', 'Right Hand', 'Right Arm', 'S', 1500],
  ['Vishal Thakkar', 'All-Rounder', 'Right Hand', 'Right Arm', 'M', 3000],
  ['Jigar Modi', 'Wicket Keeper', 'Right Hand', 'None', 'L', 2000],
  ['Chirag Soni', 'Batsman', 'Right Hand', 'Right Arm', 'M', 1500],
  ['Bhavin Prajapati', 'Bowler', 'Left Hand', 'Left Arm', 'XL', 2000],
  ['Darshan Amin', 'All-Rounder', 'Left Hand', 'Left Arm', 'L', 2500],
];

async function run() {
  await connectDB();

  if (fresh) {
    console.log('Wiping auction data...');
    await Promise.all([
      Player.deleteMany({}), Team.deleteMany({}), Captain.deleteMany({}), Auction.deleteMany({}),
      Bid.deleteMany({}), Transaction.deleteMany({}), Round.deleteMany({}), Settings.deleteMany({}),
    ]);
  }

  // Admin
  let admin = await Admin.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (!admin) {
    admin = await Admin.create({ name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD });
    console.log(`Admin created: ${admin.email} / ${env.ADMIN_PASSWORD}`);
  } else {
    console.log(`Admin exists: ${admin.email}`);
  }

  // Settings
  const settings = await Settings.get();
  settings.bidIncrement = 500;
  settings.minBid = 500;
  settings.maxBid = 0;
  settings.defaultBasePrice = 2000;
  settings.allowPreviousTeamRebid = true;
  await settings.save();
  await Round.updateOne({ number: settings.currentRound }, { $setOnInsert: { number: settings.currentRound } }, { upsert: true });
  console.log('Settings ready (increment ₹500, min ₹500, no max, previous team may re-bid)');

  // Teams + captains
  for (const t of TEAMS) {
    let team = await Team.findOne({ name: t.name });
    if (team) { console.log(`Team exists: ${team.name}`); continue; }
    team = await Team.create({ name: t.name, color: t.color, totalBudget: t.totalBudget, usedBudget: 0, maxPlayers: 8, minPlayers: 5 });
    await Transaction.create({
      team: team._id, type: 'INITIAL_BUDGET', amount: team.totalBudget, balanceAfter: team.remainingBudget,
      description: `Initial budget ₹${team.totalBudget.toLocaleString('en-IN')}`, createdBy: admin._id,
    });
    const captain = await Captain.create({ ...t.captain, team: team._id });
    team.captain = captain._id;
    await team.save();
    console.log(`Team created: ${team.name} (captain ${captain.name})`);
  }

  // Players
  let added = 0;
  for (const [name, playerType, battingStyle, bowlingStyle, tshirtSize, basePrice] of PLAYERS) {
    const exists = await Player.findOne({ name });
    if (exists) continue;
    await Player.create({
      name, playerType, battingStyle, bowlingStyle, tshirtSize, basePrice,
      phone: `98765${String(10000 + added).padStart(5, '0')}`,
      address: 'Ahmedabad, Gujarat',
      status: 'Available',
      auctionRound: settings.currentRound,
    });
    added += 1;
  }
  console.log(`Players added: ${added} (total ${await Player.countDocuments()})`);

  await mongoose.disconnect();
  console.log('Seed complete.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
