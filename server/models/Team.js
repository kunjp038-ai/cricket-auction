const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Team name is required'], unique: true, trim: true, maxlength: 60 },
    logo: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '#1f6feb' },
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', default: null },
    totalBudget: { type: Number, required: true, min: [0, 'Budget cannot be negative'] },
    usedBudget: { type: Number, default: 0, min: [0, 'Used budget cannot be negative'] },
    remainingBudget: { type: Number, default: 0, min: [0, 'Remaining budget can never become negative'] },
    maxPlayers: { type: Number, default: 15, min: 1 },
    minPlayers: { type: Number, default: 11, min: 0 },
    players: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

teamSchema.virtual('playerCount').get(function playerCount() {
  return Array.isArray(this.players) ? this.players.length : 0;
});

// Remaining Budget = Total Budget - Used Budget (always derived, never trusted from input).
teamSchema.pre('validate', function computeRemaining(next) {
  this.remainingBudget = Math.round((this.totalBudget - this.usedBudget) * 100) / 100;
  if (this.minPlayers > this.maxPlayers) {
    this.invalidate('minPlayers', 'Minimum players cannot exceed maximum players');
  }
  next();
});

module.exports = mongoose.model('Team', teamSchema);
