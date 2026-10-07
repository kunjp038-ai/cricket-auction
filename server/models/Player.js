const mongoose = require('mongoose');
const { PHONE_REGEX } = require('../utils/format');

const PLAYER_TYPES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'];
const BATTING_STYLES = ['Right Hand', 'Left Hand'];
const BOWLING_STYLES = ['Right Arm', 'Left Arm', 'None'];
const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const PLAYER_STATUS = ['Available', 'Sold', 'Unsold', 'Released', 'Re-Auction'];
// Statuses that make a player eligible to be put up for auction.
const POOL_STATUSES = ['Available', 'Re-Auction', 'Released'];

const playerSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Player name is required'], trim: true, maxlength: 80 },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: { validator: (v) => PHONE_REGEX.test(v), message: 'Invalid phone number' },
    },
    playerType: { type: String, required: true, enum: PLAYER_TYPES },
    battingStyle: { type: String, required: true, enum: BATTING_STYLES },
    bowlingStyle: { type: String, required: true, enum: BOWLING_STYLES, default: 'None' },
    tshirtSize: { type: String, required: true, enum: TSHIRT_SIZES, default: 'M' },
    address: { type: String, trim: true, maxlength: 1000, default: '' },
    photo: { type: String, trim: true, default: '' },
    basePrice: { type: Number, required: true, min: [0, 'Base price cannot be negative'] },
    status: { type: String, enum: PLAYER_STATUS, default: 'Available', index: true },
    currentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    // Price the player was last sold for (0 when not owned by a team).
    soldPrice: { type: Number, default: 0 },
    // Round in which the player was last auctioned / is scheduled to be auctioned.
    auctionRound: { type: Number, default: 1 },
    releaseCount: { type: Number, default: 0 },
    lastReleasedAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

playerSchema.index({ name: 'text' });
playerSchema.index({ name: 1 });
playerSchema.index({ playerType: 1, status: 1 });

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
module.exports.PLAYER_TYPES = PLAYER_TYPES;
module.exports.BATTING_STYLES = BATTING_STYLES;
module.exports.BOWLING_STYLES = BOWLING_STYLES;
module.exports.TSHIRT_SIZES = TSHIRT_SIZES;
module.exports.PLAYER_STATUS = PLAYER_STATUS;
module.exports.POOL_STATUSES = POOL_STATUSES;
