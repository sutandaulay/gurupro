import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    exclude: ['tests/e2e/**', '**/node_modules/**'],
    setupFiles: ['tests/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@payload-config': path.resolve(__dirname, 'payload.config.ts'),
    },
  },
})
