const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { UPLOAD_DIR } = require('./middleware/upload');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(
  cors((req, cb) => {
    // Allow: no Origin header (server-to-server), configured CLIENT_URL origins, development,
    // and same-host requests (frontend served by this same deployment, e.g. Vercel).
    const origin = req.headers.origin;
    let allowed = !origin || env.CLIENT_URLS.includes(origin) || env.NODE_ENV === 'development';
    if (!allowed && origin) {
      try {
        allowed = new URL(origin).host === req.headers.host;
      } catch (e) {
        allowed = false;
      }
    }
    cb(null, { origin: allowed, credentials: true });
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/api', routes);

// In production serve the built React client from the same origin.
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/uploads|\/socket\.io).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
