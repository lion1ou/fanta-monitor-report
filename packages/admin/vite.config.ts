import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 开发时把 /v1 代理到采集服务；生产构建产物由 @fanta/server 托管在 /admin/
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 5173,
    proxy: { '/v1': 'http://localhost:5001' }
  },
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    include: ['__test__/**/*.test.{ts,tsx}'],
    setupFiles: ['__test__/setup.ts'],
    restoreMocks: true
  }
})
