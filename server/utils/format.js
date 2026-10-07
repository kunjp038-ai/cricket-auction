const formatINR = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
// Indian 10-digit mobile numbers, or an international number with optional + and 10-15 digits.
const PHONE_REGEX = /^(?:[6-9]\d{9}|\+?\d{10,15})$/;
module.exports = { formatINR, PHONE_REGEX };
