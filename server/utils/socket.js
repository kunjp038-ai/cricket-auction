const { Server } = require('socket.io');
const env = require('../config/env');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URLS, methods: ['GET', 'POST'], credentials: true },
  });

  io.on('connection', (socket) => {
    socket.join('auction');
    socket.emit('connected', { message: 'Connected to auction server', at: new Date() });
  });

  console.log('Socket.IO initialised');
  return io;
}

function getIO() {
  return io;
}

/** Broadcast an auction event to every connected auction screen. */
function emitAuctionEvent(event, payload = {}) {
  if (!io) return;
  io.to('auction').emit(event, { ...payload, at: new Date() });
}

module.exports = { initSocket, getIO, emitAuctionEvent };
