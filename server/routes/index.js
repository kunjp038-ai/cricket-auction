const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const dashboardController = require('../controllers/dashboardController');
const ApiError = require('../utils/ApiError');

router.use('/auth', require('./authRoutes'));
router.use('/players', require('./playerRoutes'));
router.use('/teams', require('./teamRoutes'));
router.use('/captains', require('./captainRoutes'));
router.use('/auctions', require('./auctionRoutes'));
router.use('/settings', require('./settingsRoutes'));

router.get('/dashboard', protect, dashboardController.admin);

// Image upload for player photos / team logos / captain photos.
router.post('/upload', protect, upload.single('image'), (req, res, next) => {
  if (!req.file) return next(ApiError.badRequest('No image uploaded. Send a multipart field named "image".'));
  res.status(201).json({ success: true, url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date() }));

module.exports = router;
