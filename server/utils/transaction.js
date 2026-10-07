const mongoose = require('mongoose');
const { dbState } = require('../config/db');

/**
 * Runs `fn(session)` inside a MongoDB multi-document transaction.
 * Every write inside fn must pass `{ session }`. If any step throws, all writes are rolled back.
 * On a standalone mongod (no replica set) it degrades to running without a session.
 */
async function runInTransaction(fn) {
  if (!dbState.supportsTransactions) {
    return fn(null);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readPreference: 'primary', readConcern: { level: 'local' }, writeConcern: { w: 'majority' } }
    );
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = { runInTransaction };
