import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API and Socket.IO server run on :5000; Vite proxies them so the
// browser only talks to one origin and no MongoDB credentials ever reach the client.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
