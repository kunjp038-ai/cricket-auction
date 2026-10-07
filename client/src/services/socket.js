import { io } from 'socket.io-client';

/**
 * Set VITE_DISABLE_SOCKET=true on hosts that cannot keep WebSocket connections open
 * (e.g. Vercel serverless). Screens then fall back to polling the REST API.
 */
export const SOCKET_DISABLED = import.meta.env.VITE_DISABLE_SOCKET === 'true';

let socket = null;

/** Single shared Socket.IO connection for the whole app (null when disabled). */
export function getSocket() {
  if (SOCKET_DISABLED) return null;
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(url, { transports: ['websocket', 'polling'], autoConnect: true, reconnectionDelayMax: 5000 });
  }
  return socket;
}

export const AUCTION_EVENTS = [
  'auction:started',
  'auction:bid',
  'auction:sold',
  'auction:unsold',
  'auction:cancelled',
  'auction:pool-empty',
  'player:released',
  'round:started',
  'teams:updated',
  'players:updated',
  'settings:updated',
];
