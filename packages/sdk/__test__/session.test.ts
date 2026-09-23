import { describe, it, expect, beforeEach } from 'vitest'
import { touchSession, SESSION_TIMEOUT } from '../src/common/session'

describe('touchSession', () => {
  beforeEach(() => { window.sessionStorage.clear() })

  it('连续调用返回同一会话 id', () => {
    const first = touchSession(1_000)
    expect(touchSession(2_000)).toBe(first)
  })

  it('超过 30 分钟无活动后生成新会话 id', () => {
    const first = touchSession(1_000)
    expect(touchSession(1_000 + SESSION_TIMEOUT + 1)).not.toBe(first)
  })

  it('每次调用刷新活跃时间，持续活动不过期', () => {
    const first = touchSession(0)
    touchSession(SESSION_TIMEOUT - 1)
    expect(touchSession(SESSION_TIMEOUT * 2 - 2)).toBe(first)
  })
})
