import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest runs the component and lib tests in jsdom. mapLocation.test.js uses
// Node's own test runner (node:test), so it is excluded here and run separately
// via `node --test` (see the "test" script in package.json).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['src/lib/mapLocation.test.js', 'node_modules/**'],
  },
})
