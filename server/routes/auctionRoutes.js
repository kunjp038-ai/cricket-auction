const router = require('express').Router();
const ctrl = require('../controllers/auctionController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectId, bidBody, soldBody } = require('../middleware/validators');

// Public read-only endpoints (used by the big-screen live display).
router.get('/current', ctrl.current);
router.get('/history', ctrl.history);
router.get('/rounds', ctrl.rounds);

router.use(protect);
router.get('/pool', ctrl.pool);
router.post('/start', ctrl.start);
router.post('/next', ctrl.next);
router.post('/reauction', ctrl.reauction);
router.post('/:id/bid', objectId('id'), bidBody, validate, ctrl.bid);
router.post('/:id/sold', objectId('id'), soldBody, validate, ctrl.sold);
router.post('/:id/unsold', objectId('id'), validate, ctrl.unsold);
router.post('/:id/cancel', objectId('id'), validate, ctrl.cancel);
router.post('/:id/undo-bid', objectId('id'), validate, ctrl.undoBid);
router.post('/:id/timer', objectId('id'), validate, ctrl.resetTimer);
router.post('/:id/next', objectId('id'), validate, ctrl.next);

module.exports = router;
