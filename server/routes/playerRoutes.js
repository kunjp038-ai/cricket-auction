const router = require('express').Router();
const ctrl = require('../controllers/playerController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectId, playerBody } = require('../middleware/validators');

router.use(protect);

router.get('/meta', ctrl.meta);
router.get('/', ctrl.list);
router.post('/', playerBody(false), validate, ctrl.create);
router.get('/:id', objectId('id'), validate, ctrl.get);
router.put('/:id', objectId('id'), playerBody(true), validate, ctrl.update);
router.delete('/:id', objectId('id'), validate, ctrl.remove);
router.post('/:id/release', objectId('id'), validate, ctrl.release);
router.get('/:id/history', objectId('id'), validate, ctrl.history);

module.exports = router;
