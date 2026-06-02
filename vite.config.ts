/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Data-Acquisition-Interface/',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    alias: { '@': '/src' },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
