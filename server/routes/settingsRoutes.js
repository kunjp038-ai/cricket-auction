const router = require('express').Router();
const ctrl = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { settingsBody } = require('../middleware/validators');

router.get('/', ctrl.get);
router.put('/', protect, settingsBody, validate, ctrl.update);

module.exports = router;
