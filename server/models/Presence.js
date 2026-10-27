const mongoose = require('mongoose');

/**
 * Heartbeat of every open screen (public live viewers and admin consoles).
 * Each screen sends its random client id with every poll; rows expire automatically.
 */
const presenceSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  kind: { type: String, enum: ['viewer', 'admin'], default: 'viewer' },
  lastSeen: { type: Date, default: Date.now },
});

// MongoDB removes rows ~2 minutes after the last heartbeat.
presenceSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 120 });

module.exports = mongoose.model('Presence', presenceSchema);
