import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // La web nunca habla directo con un servicio: todo `/api` va al gateway.
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  test: {
    css: { include: [/main.css/] },
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
