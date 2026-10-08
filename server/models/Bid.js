const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema(
  {
    auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    bidderName: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    // How much this bid added on top of the previous total (0 = opening bid at base price).
    raise: { type: Number, default: 0 },
    round: { type: Number, required: true },
    placedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Bid', bidSchema);
