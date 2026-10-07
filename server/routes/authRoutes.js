const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { loginBody } = require('../middleware/validators');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

router.post('/login', loginLimiter, loginBody, validate, ctrl.login);
router.get('/setup-status', ctrl.setupStatus);
router.post('/setup', loginLimiter, ctrl.setup);
router.get('/me', protect, ctrl.me);
router.post('/change-password', protect, ctrl.changePassword);

module.exports = router;
