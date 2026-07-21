import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5178, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
