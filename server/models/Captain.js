const mongoose = require('mongoose');
const { PHONE_REGEX } = require('../utils/format');

const captainSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Captain name is required'], trim: true, maxlength: 80 },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: { validator: (v) => PHONE_REGEX.test(v), message: 'Invalid phone number' },
    },
    photo: { type: String, trim: true, default: '' },
    // Unique + sparse: a team can only have one captain at a time.
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  },
  { timestamps: true }
);

captainSchema.index({ team: 1 }, { unique: true, partialFilterExpression: { team: { $type: 'objectId' } } });

module.exports = mongoose.model('Captain', captainSchema);
