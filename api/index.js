/**
 * Vercel serverless entry point.
 * Wraps the Express app so every /api/* request is handled by one function.
 * The Mongoose connection is cached per warm instance.
 */
const { connectDB } = require('../server/config/db');
const app = require('../server/app');

let ready = null;

module.exports = async (req, res) => {
  try {
    if (!ready) ready = connectDB();
    await ready;
  } catch (err) {
    ready = null;
    console.error('MongoDB connection failed:', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, message: 'Database connection failed. Check MONGODB_URI and Atlas network access.' }));
  }
  return app(req, res);
};
