import { describe, it, expect, vi, beforeEach } from 'vitest'
import Store from '../src/common/store'

const sdk = { version: '0.1.0', env: 'test' }

describe('Store.init', () => {
  const getCurrentPosition = vi.fn()

  beforeEach(() => {
    getCurrentPosition.mockReset()
    Object.defineProperty(window.navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
  })

  it('默认不请求地理位置授权，enableGeo 为 true 时才请求', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo' }, sdk)
    expect(getCurrentPosition).not.toHaveBeenCalled()

    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo', enableGeo: true }, sdk)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('上下文只包含事件字段，初始化配置不混入', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo', appVersion: '1.2.3', batchSize: 3 }, sdk)
    const context: Record<string, unknown> = { ...Store.getContext() }
    expect(context.appName).toBe('demo')
    expect(context.appVersion).toBe('1.2.3')
    expect(context.sdkVersion).toBe('0.1.0')
    expect(context.uuid).toBeTruthy()
    expect(context).not.toHaveProperty('reportHost')
    expect(context).not.toHaveProperty('batchSize')
    expect(context).not.toHaveProperty('ip')
  })

  it('配置合并默认值，autoTrack 局部覆盖', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo', autoTrack: { error: false } }, sdk)
    expect(Store.config.batchSize).toBe(10)
    expect(Store.config.flushInterval).toBe(5000)
    expect(Store.config.autoTrack).toEqual({ pageView: true, error: false, performance: true })
  })

  it('setUserId 更新上下文', () => {
    Store.init({ reportHost: 'http://x/v1/track', appName: 'demo' }, sdk)
    Store.setUserId('u-9')
    expect(Store.getContext().userId).toBe('u-9')
  })
})
