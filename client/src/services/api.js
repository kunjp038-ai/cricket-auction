import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || '/api';
export const TOKEN_KEY = 'cricket_auction_token';

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message || 'Request failed';
    if (status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login' && window.location.pathname !== '/live') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(Object.assign(new Error(message), { status, details: err.response?.data?.details }));
  }
);

/** Resolve a stored photo/logo path to a URL the browser can load. */
export function assetUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const origin = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL, window.location.origin).origin : '';
  return `${origin}${path}`;
}

/* ---------------- Auth ---------------- */
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  setupStatus: () => api.get('/auth/setup-status'),
  setup: (data) => api.post('/auth/setup', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

/* ---------------- Players ---------------- */
export const playersApi = {
  meta: () => api.get('/players/meta'),
  list: (params) => api.get('/players', { params }),
  get: (id) => api.get(`/players/${id}`),
  create: (data) => api.post('/players', data),
  update: (id, data) => api.put(`/players/${id}`, data),
  remove: (id) => api.delete(`/players/${id}`),
  release: (id) => api.post(`/players/${id}/release`),
  history: (id) => api.get(`/players/${id}/history`),
};

/* ---------------- Teams ---------------- */
export const teamsApi = {
  list: () => api.get('/teams'),
  get: (id) => api.get(`/teams/${id}`),
  create: (data) => api.post('/teams', data),
  update: (id, data) => api.put(`/teams/${id}`, data),
  remove: (id) => api.delete(`/teams/${id}`),
  assignCaptain: (id, captainId) => api.put(`/teams/${id}/captain`, { captainId }),
  dashboard: (id) => api.get(`/teams/${id}/dashboard`),
  squads: () => api.get('/teams/squads'),
};

/* ---------------- Captains ---------------- */
export const captainsApi = {
  list: () => api.get('/captains'),
  create: (data) => api.post('/captains', data),
  update: (id, data) => api.put(`/captains/${id}`, data),
  remove: (id) => api.delete(`/captains/${id}`),
};

/* ---------------- Auction ---------------- */
export const auctionApi = {
  current: () => api.get('/auctions/current'),
  start: (playerId) => api.post('/auctions/start', playerId ? { playerId } : {}),
  // increment: 0 = open at base price, otherwise amount added to the current total (e.g. 500 / 1000).
  bid: (auctionId, teamId, increment) => api.post(`/auctions/${auctionId}/bid`, { teamId, increment }),
  undoBid: (auctionId) => api.post(`/auctions/${auctionId}/undo-bid`),
  // Pass { teamId, amount } to record a verbal auction result directly; omit to sell to the current highest bidder.
  sold: (auctionId, data) => api.post(`/auctions/${auctionId}/sold`, data || {}),
  unsold: (auctionId) => api.post(`/auctions/${auctionId}/unsold`),
  cancel: (auctionId) => api.post(`/auctions/${auctionId}/cancel`),
  resetTimer: (auctionId, seconds) => api.post(`/auctions/${auctionId}/timer`, seconds ? { seconds } : {}),
  next: () => api.post('/auctions/next'),
  reauction: (includeUnsold = true) => api.post('/auctions/reauction', { includeUnsold }),
  history: (params) => api.get('/auctions/history', { params }),
  rounds: () => api.get('/auctions/rounds'),
  pool: () => api.get('/auctions/pool'),
};

/* ---------------- Misc ---------------- */
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};

export const dashboardApi = { admin: () => api.get('/dashboard') };

export const uploadApi = {
  image: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
