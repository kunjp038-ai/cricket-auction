const mongoose = require('mongoose');

/**
 * Uploaded images (player photos, team logos, captain photos) stored in MongoDB so they
 * survive on serverless hosts like Vercel where the disk is not persistent.
 * Images are resized in the browser before upload (max ~600px), so each is small.
 */
const imageSchema = new mongoose.Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('Image', imageSchema);
