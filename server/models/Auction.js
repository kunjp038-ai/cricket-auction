const mongoose = require('mongoose');

const AUCTION_STATUS = ['LIVE', 'SOLD', 'UNSOLD', 'CANCELLED'];

/**
 * One document per "player put on the block". A player can have many of these
 * (one per round they were auctioned in). Records are NEVER deleted - they are
 * the permanent auction history.
 */
const auctionSchema = new mongoose.Schema(
  {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
    round: { type: Number, required: true, index: true },
    status: { type: String, enum: AUCTION_STATUS, default: 'LIVE' },
    basePrice: { type: Number, required: true, min: 0 },
    currentBid: { type: Number, default: 0 },
    highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    bidCount: { type: Number, default: 0 },
    finalBid: { type: Number, default: null },
    winningTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    // Team that owned the player before a release (used for the "allow previous team to re-bid" rule).
    previousTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    // Per-player countdown configured for the round (0 = no timer).
    timerSeconds: { type: Number, default: 0 },
    timerEndsAt: { type: Date, default: null },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
    // Set when the winning team later releases the player. The SOLD record itself is preserved.
    releasedAt: { type: Date, default: null },
    conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

// Only one LIVE auction can exist at any time.
auctionSchema.index({ status: 1 }, { unique: true, partialFilterExpression: { status: 'LIVE' } });

module.exports = mongoose.model('Auction', auctionSchema);
module.exports.AUCTION_STATUS = AUCTION_STATUS;
