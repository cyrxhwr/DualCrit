import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind v4 runs as a Vite plugin — no postcss.config.js, and only one
// Tailwind package, so the v3/v4 mismatch in the previous project cannot recur.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
