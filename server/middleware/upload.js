const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

// On serverless hosts (Vercel) the project directory is read-only; only /tmp is writable
// and it does not persist between invocations. Use external image URLs there.
const UPLOAD_DIR = process.env.VERCEL
  ? path.join(require('os').tmpdir(), 'cricket-auction-uploads')
  : path.resolve(__dirname, '../uploads');
try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.warn(`Upload directory not writable (${UPLOAD_DIR}): ${err.message}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Only PNG, JPG, WEBP, GIF or SVG images are allowed.'));
  },
});

module.exports = { upload, UPLOAD_DIR };
