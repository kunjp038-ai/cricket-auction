const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    // Size of the auction pool when the round was opened.
    playersAtStart: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Round', roundSchema);
