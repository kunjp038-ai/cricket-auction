const router = require('express').Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Image = require('../models/Image');
const { protect } = require('../middleware/auth');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Keep the file in memory and store it in MongoDB (works on Vercel, no disk needed).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) return cb(null, true);
    cb(ApiError.badRequest('Only PNG, JPG, WEBP or GIF images are allowed.'));
  },
});

/** POST /api/images  (multipart field "image") -> { url: "/api/images/<id>" } */
router.post('/', protect, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded. Send a multipart field named "image".');
  const img = await Image.create({
    data: req.file.buffer,
    contentType: req.file.mimetype,
    size: req.file.size,
    originalName: req.file.originalname,
    uploadedBy: req.admin._id,
  });
  res.status(201).json({ success: true, url: `/api/images/${img._id}`, id: img._id, size: img.size });
}));

/** GET /api/images/:id  -> the image bytes (public, cached) */
router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.notFound('Image not found');
  const img = await Image.findById(req.params.id);
  if (!img) throw ApiError.notFound('Image not found');
  res.set('Content-Type', img.contentType);
  res.set('Content-Length', String(img.data.length));
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(img.data);
}));

module.exports = router;
