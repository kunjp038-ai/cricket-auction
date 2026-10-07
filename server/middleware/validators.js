const { body, param } = require('express-validator');
const { PHONE_REGEX } = require('../utils/format');
const {
  PLAYER_TYPES, BATTING_STYLES, BOWLING_STYLES, TSHIRT_SIZES, PLAYER_STATUS,
} = require('../models/Player');

const objectId = (field) => param(field).isMongoId().withMessage(`${field} must be a valid id`);

const phone = (field, optional) => {
  let chain = body(field).trim();
  if (optional) chain = chain.optional({ values: 'falsy' });
  return chain.matches(PHONE_REGEX).withMessage('Phone number must be a valid 10-digit (or international) number');
};

const playerBody = (isUpdate = false) => {
  const opt = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    body('playerNo').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Player number must be a whole number of 1 or more').toInt(),
    opt(body('name').trim().notEmpty().withMessage('Player name is required').isLength({ max: 80 })),
    phone('phone', isUpdate),
    opt(body('playerType').isIn(PLAYER_TYPES).withMessage(`Player type must be one of: ${PLAYER_TYPES.join(', ')}`)),
    opt(body('battingStyle').isIn(BATTING_STYLES).withMessage(`Batting style must be one of: ${BATTING_STYLES.join(', ')}`)),
    opt(body('bowlingStyle').isIn(BOWLING_STYLES).withMessage(`Bowling style must be one of: ${BOWLING_STYLES.join(', ')}`)),
    opt(body('tshirtSize').isIn(TSHIRT_SIZES).withMessage(`T-shirt size must be one of: ${TSHIRT_SIZES.join(', ')}`)),
    body('address').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }).withMessage('Address is too long'),
    body('photo').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
    body('basePrice').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Base price must be a positive number').toFloat(),
    body('status').optional().isIn(PLAYER_STATUS).withMessage(`Status must be one of: ${PLAYER_STATUS.join(', ')}`),
  ];
};

const teamBody = (isUpdate = false) => {
  const opt = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    opt(body('name').trim().notEmpty().withMessage('Team name is required').isLength({ max: 60 })),
    body('logo').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
    body('color').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
    opt(body('totalBudget').isFloat({ min: 0 }).withMessage('Total budget must be a positive number').toFloat()),
    body('maxPlayers').optional().isInt({ min: 1, max: 50 }).withMessage('Max players must be between 1 and 50').toInt(),
    body('minPlayers').optional().isInt({ min: 0, max: 50 }).withMessage('Min players must be between 0 and 50').toInt(),
    body('captain').optional({ values: 'null' }).isMongoId().withMessage('captain must be a valid id'),
  ];
};

const captainBody = (isUpdate = false) => {
  const opt = (chain) => (isUpdate ? chain.optional() : chain);
  return [
    opt(body('name').trim().notEmpty().withMessage('Captain name is required').isLength({ max: 80 })),
    phone('phone', isUpdate),
    body('photo').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
    body('team').optional({ values: 'null' }).isMongoId().withMessage('team must be a valid id'),
  ];
};

const settingsBody = [
  body('bidIncrement').optional().isFloat({ min: 1 }).withMessage('Bid increment must be at least 1').toFloat(),
  body('minBid').optional().isFloat({ min: 0 }).withMessage('Minimum bid must be >= 0').toFloat(),
  body('maxBid').optional().isFloat({ min: 0 }).withMessage('Maximum bid must be >= 0 (0 = no limit)').toFloat(),
  body('defaultBasePrice').optional().isFloat({ min: 0 }).toFloat(),
  body('defaultTimerSeconds').optional().isInt({ min: 0, max: 3600 }).withMessage('Timer must be 0-3600 seconds').toInt(),
  body('allowPreviousTeamRebid').optional().isBoolean().toBoolean(),
  body('autoNextPlayer').optional().isBoolean().toBoolean(),
  body('auctionOrder').optional().isIn(['random', 'number']).withMessage('auctionOrder must be random or number'),
  body('auctionName').optional().trim().isLength({ max: 100 }),
  body('sounds').optional().isObject().withMessage('sounds must be an object'),
  body('sounds.*').optional({ values: 'falsy' }).isString().trim().isLength({ max: 1000 }).withMessage('Sound URL is too long'),
  body('roundConfigs').optional().isArray({ max: 50 }).withMessage('roundConfigs must be an array'),
  body('roundConfigs.*.round').isInt({ min: 1 }).withMessage('Round number must be 1 or more').toInt(),
  body('roundConfigs.*.basePrice').isFloat({ min: 0 }).withMessage('Round base price must be a positive number').toFloat(),
  body('roundConfigs.*.timerSeconds').optional().isInt({ min: 0, max: 3600 }).withMessage('Timer must be 0-3600 seconds').toInt(),
];

const loginBody = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const bidBody = [body('teamId').isMongoId().withMessage('teamId is required')];

const soldBody = [
  body('teamId').optional().isMongoId().withMessage('teamId must be a valid id'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('amount must be a positive number').toFloat(),
];

module.exports = { objectId, playerBody, teamBody, captainBody, settingsBody, loginBody, bidBody, soldBody };
