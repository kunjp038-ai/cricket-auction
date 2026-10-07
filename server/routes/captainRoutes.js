const router = require('express').Router();
const ctrl = require('../controllers/captainController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectId, captainBody } = require('../middleware/validators');

router.use(protect);

router.get('/', ctrl.list);
router.post('/', captainBody(false), validate, ctrl.create);
router.get('/:id', objectId('id'), validate, ctrl.get);
router.put('/:id', objectId('id'), captainBody(true), validate, ctrl.update);
router.delete('/:id', objectId('id'), validate, ctrl.remove);

module.exports = router;
