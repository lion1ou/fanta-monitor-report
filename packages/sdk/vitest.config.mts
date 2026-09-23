import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@fanta/shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)) }
  },
  test: {
    environment: 'jsdom',
    include: ['__test__/**/*.test.ts'],
    setupFiles: ['__test__/setup.ts'],
    restoreMocks: true
  }
})
