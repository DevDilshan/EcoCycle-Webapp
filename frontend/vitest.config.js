import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest runs the component and lib tests in jsdom. The coordinate and area-search tests use
// Node's own test runner (node:test), so they are excluded here and run separately
// via `node --test` (see the "test" script in package.json).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    exclude: ['src/lib/mapLocation.test.js', 'src/lib/serviceAreaSearch.test.js', 'node_modules/**'],
  },
})
