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
    // Fallback base price for rounds that have no entry in roundConfigs.
    defaultBasePrice: { type: Number, default: 2000, min: 0 },
    // Fallback per-player timer (seconds) for rounds with no entry. 0 = no timer.
    defaultTimerSeconds: { type: Number, default: 60, min: 0 },
    // Per-round rules: every player in a round shares the same base price and timer.
    roundConfigs: {
      type: [
        {
          _id: false,
          round: { type: Number, required: true, min: 1 },
          basePrice: { type: Number, required: true, min: 0 },
          timerSeconds: { type: Number, default: 60, min: 0 },
        },
      ],
      default: () => [
        { round: 1, basePrice: 2000, timerSeconds: 60 },
        { round: 2, basePrice: 1000, timerSeconds: 60 },
      ],
    },
    // Optional music URLs per event (empty = built-in music on the client).
    sounds: {
      countdown: { type: String, default: '', trim: true },
      timeUp: { type: String, default: '', trim: true },
      sold: { type: String, default: '', trim: true },
      unsold: { type: String, default: '', trim: true },
      start: { type: String, default: '', trim: true },
    },
    allowPreviousTeamRebid: { type: Boolean, default: true },
    // After SOLD / UNSOLD automatically put the next player (by number) on the block.
    autoNextPlayer: { type: Boolean, default: true },
    currentRound: { type: Number, default: 1, min: 1 },
  },
  { timestamps: true }
);

/** Base price + timer for a round (falls back to the defaults). */
settingsSchema.methods.getRoundConfig = function getRoundConfig(round) {
  const cfg = (this.roundConfigs || []).find((c) => c.round === round);
  return {
    round,
    basePrice: cfg ? cfg.basePrice : this.defaultBasePrice,
    timerSeconds: cfg ? cfg.timerSeconds : this.defaultTimerSeconds,
    configured: Boolean(cfg),
  };
};

settingsSchema.statics.get = async function getSettings(session) {
  let doc = await this.findOne({ key: 'global' }).session(session || null);
  if (!doc) {
    [doc] = await this.create([{ key: 'global' }], { session: session || undefined });
  }
  return doc;
};

module.exports = mongoose.model('Settings', settingsSchema);
