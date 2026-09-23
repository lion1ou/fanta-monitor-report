import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// recharts 的 ResponsiveContainer 依赖 ResizeObserver，jsdom 没有实现
class ResizeObserverStub {
  observe () {}
  unobserve () {}
  disconnect () {}
}
window.ResizeObserver = window.ResizeObserver ?? (ResizeObserverStub as unknown as typeof ResizeObserver)

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
