const mongoose = require('mongoose');

const TRANSACTION_TYPES = ['INITIAL_BUDGET', 'PLAYER_PURCHASE', 'PLAYER_RELEASE', 'BUDGET_ADJUSTMENT'];

/**
 * Financial ledger for every team. `amount` is signed:
 *   + credit (initial budget, release refund, positive adjustment)
 *   - debit  (player purchase, negative adjustment)
 * `balanceAfter` is the remaining budget right after this entry, so the ledger
 * can always be audited independently of the Team document.
 */
const transactionSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
    auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    round: { type: Number, default: null },
    description: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Transaction', transactionSchema);
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
