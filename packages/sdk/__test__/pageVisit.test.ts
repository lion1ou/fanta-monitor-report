import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startPageVisit } from '../src/h5/h5PageVisit'

describe('startPageVisit', () => {
  beforeEach(() => { window.history.replaceState({}, '', '/') })

  it('初始化立即上报 init，且 from 为空', () => {
    const report = vi.fn()
    startPageVisit(report)
    expect(report).toHaveBeenCalledWith({ trigger: 'init', from: '' })
  })

  it('pushState 上报并携带上一个 URL', () => {
    const report = vi.fn()
    startPageVisit(report)
    const previous = window.location.href
    window.history.pushState({}, '', '/a')
    expect(report).toHaveBeenLastCalledWith({ trigger: 'pushState', from: previous })
    expect(window.location.pathname).toBe('/a')
  })

  it('replaceState 到同一 URL 不重复上报', () => {
    const report = vi.fn()
    startPageVisit(report)
    window.history.replaceState({}, '', '/')
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('popstate 时 URL 变化则上报，未变化不上报', () => {
    const report = vi.fn()
    startPageVisit(report)
    window.history.pushState({}, '', '/b')
    expect(report).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(report).toHaveBeenCalledTimes(2)
    window.history.replaceState({}, '', '/c')
    expect(report).toHaveBeenLastCalledWith({ trigger: 'replaceState', from: `${window.location.origin}/b` })
  })
})
