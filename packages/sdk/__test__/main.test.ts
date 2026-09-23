import { describe, it, expect, vi, beforeEach } from 'vitest'
import { trackEventSchema, type TrackBatch } from '@fanta/shared'
import { initReport, click, setUserId, flush } from '../src/main'

describe('initReport', () => {
  const sendBeacon = vi.fn().mockReturnValue(true)

  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    sendBeacon.mockClear()
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
  })

  it('缺少 reportHost 或 appName 时抛错', () => {
    expect(() => initReport({ reportHost: '', appName: 'x' })).toThrow('reportHost')
    expect(() => initReport({ reportHost: 'http://x', appName: '' })).toThrow('appName')
  })

  it('初始化后自动上报 PageView，事件包含契约要求的全部字段', async () => {
    initReport({ reportHost: 'http://localhost:5001/v1/track', appName: 'demo', appVersion: '9.9.9' })
    setUserId('u-1')
    click({ button: 'ok' })
    await flush()

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const batch: TrackBatch = JSON.parse(sendBeacon.mock.calls[0][1] as string)
    expect(batch.events.map((e) => e.trackType)).toEqual(['PageView', 'Click'])
    const [pv, clickEvent] = batch.events
    expect(pv.trackData).toEqual({ trigger: 'init', from: '' })
    expect(pv.fingerPrint).toHaveLength(32)
    expect(pv.fingerPrintCanvas).toHaveLength(32)
    expect(pv.isWebdriver).toBe(false)
    expect(clickEvent.userId).toBe('u-1')
    expect(clickEvent.appVersion).toBe('9.9.9')
    expect(clickEvent.sessionId).toBe(pv.sessionId)
    for (const key of trackEventSchema.required) {
      expect(clickEvent, `missing ${key}`).toHaveProperty(key)
    }
  })
})
