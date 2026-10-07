const mongoose = require('mongoose');
const env = require('./env');

const state = { supportsTransactions: env.USE_TRANSACTIONS };

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);

  // Multi-document transactions need a replica set / sharded cluster.
  // Atlas always provides one; a local standalone mongod does not.
  if (env.USE_TRANSACTIONS) {
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      const isReplica = Boolean(hello.setName) || hello.msg === 'isdbgrid';
      if (!isReplica) {
        state.supportsTransactions = false;
        console.warn(
          'WARNING: MongoDB is not a replica set. Multi-document transactions are disabled. ' +
            'Use MongoDB Atlas (recommended) or run a local replica set.'
        );
      }
    } catch (err) {
      console.warn('Could not detect replica set status, assuming transactions are supported.');
    }
  } else {
    console.warn('USE_TRANSACTIONS=false -> multi-document transactions are disabled.');
  }

  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
}

module.exports = { connectDB, dbState: state };
