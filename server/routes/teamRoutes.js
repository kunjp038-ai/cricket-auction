const router = require('express').Router();
const ctrl = require('../controllers/teamController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectId, teamBody } = require('../middleware/validators');

// Team list and dashboards are readable by the public live screen; mutations need an admin.
router.get('/', ctrl.list);
router.get('/:id/dashboard', objectId('id'), validate, ctrl.dashboard);
router.get('/:id', objectId('id'), validate, ctrl.get);

router.use(protect);
router.post('/', teamBody(false), validate, ctrl.create);
router.put('/:id', objectId('id'), teamBody(true), validate, ctrl.update);
router.delete('/:id', objectId('id'), validate, ctrl.remove);
router.put('/:id/captain', objectId('id'), validate, ctrl.assignCaptain);

module.exports = router;
