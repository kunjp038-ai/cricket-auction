const mongoose = require('mongoose');

// Singleton document holding the configurable auction rules.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    auctionName: { type: String, default: 'Cricket Player Auction', trim: true },
    bidIncrement: { type: Number, default: 500, min: 1 },
    // Lowest allowed base price for a player.
    minBid: { type: Number, default: 500, min: 0 },
    // Highest bid allowed for a single player. 0 = no limit.
    maxBid: { type: Number, default: 0, min: 0 },
    defaultBasePrice: { type: Number, default: 2000, min: 0 },
    allowPreviousTeamRebid: { type: Boolean, default: true },
    currentRound: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

settingsSchema.statics.get = async function getSettings(session) {
  let doc = await this.findOne({ key: 'global' }).session(session || null);
  if (!doc) {
    [doc] = await this.create([{ key: 'global' }], { session: session || undefined });
  }
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
