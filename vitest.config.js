import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.js on purpose: the Tailwind plugin isn't needed for unit
// tests and its CSS handling only slows the run down. jsdom + globals for RTL.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    css: false,
  },
})
