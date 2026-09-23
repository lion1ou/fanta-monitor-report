import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startPerformance } from '../src/h5/h5Performance'

type Callback = (list: { getEntries: () => Array<Record<string, unknown>> }) => void

class FakeObserver {
  static instances: FakeObserver[] = []
  static supportedEntryTypes = ['paint', 'largest-contentful-paint', 'layout-shift', 'first-input', 'event']
  type = ''
  constructor (public callback: Callback) { FakeObserver.instances.push(this) }
  observe (options: { type: string }) { this.type = options.type }
  disconnect () {}
  emit (entries: Array<Record<string, unknown>>) { this.callback({ getEntries: () => entries }) }
}

const navigationEntry = {
  entryType: 'navigation',
  fetchStart: 10, domainLookupStart: 10, domainLookupEnd: 15, connectStart: 15, connectEnd: 40,
  secureConnectionStart: 20, requestStart: 40, responseStart: 100, responseEnd: 150,
  domInteractive: 300, domContentLoadedEventEnd: 320, loadEventEnd: 500, transferSize: 12345
}

const emitByType = (type: string, entries: Array<Record<string, unknown>>) => {
  FakeObserver.instances.filter((o) => o.type === type).forEach((o) => o.emit(entries))
}

describe('startPerformance', () => {
  beforeEach(() => {
    FakeObserver.instances = []
    vi.stubGlobal('PerformanceObserver', FakeObserver)
    vi.spyOn(performance, 'getEntriesByType').mockImplementation((type: string) => type === 'navigation' ? [navigationEntry as unknown as PerformanceEntry] : [])
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('页面隐藏时上报导航耗时与 Web Vitals', () => {
    const report = vi.fn()
    startPerformance(report)
    emitByType('paint', [{ name: 'first-paint', startTime: 80 }, { name: 'first-contentful-paint', startTime: 120 }])
    emitByType('largest-contentful-paint', [{ startTime: 400 }, { startTime: 900 }])
    emitByType('layout-shift', [{ value: 0.05, hadRecentInput: false }, { value: 0.5, hadRecentInput: true }, { value: 0.02, hadRecentInput: false }])
    emitByType('first-input', [{ processingStart: 210, startTime: 200 }])
    emitByType('event', [{ interactionId: 5, duration: 120 }, { interactionId: 0, duration: 999 }])

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(report).toHaveBeenCalledTimes(1)
    const data = report.mock.calls[0][0]
    expect(data).toMatchObject({
      dns: 5, tcp: 25, ssl: 20, ttfb: 60, download: 50, domReady: 310, load: 490, transferSize: 12345,
      fp: 80, fcp: 120, lcp: 900, cls: 0.07, fid: 10, inp: 120
    })
  })

  it('只上报一次', () => {
    const report = vi.fn()
    startPerformance(report)
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('缺少 PerformanceObserver 时仍上报导航耗时', () => {
    vi.stubGlobal('PerformanceObserver', undefined)
    const report = vi.fn()
    startPerformance(report)
    window.dispatchEvent(new Event('pagehide'))
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0][0]).toMatchObject({ dns: 5, load: 490 })
  })
})
