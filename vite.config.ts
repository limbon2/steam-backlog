/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = Number(process.env.BACKLOG_PORT) || 4777;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
  test: {
    environment: 'node',
    include: ['{src,server,shared}/**/*.test.ts'],
  },
});
