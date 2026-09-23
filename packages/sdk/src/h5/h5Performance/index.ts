export interface PerformanceData {
  dns: number
  tcp: number
  ssl: number
  ttfb: number
  download: number
  domReady: number
  load: number
  transferSize: number
  fp?: number
  fcp?: number
  lcp?: number
  cls?: number
  fid?: number
  inp?: number
}

type Reporter = (data: PerformanceData) => void

const round = (value: number) => Math.round(value * 1000) / 1000

const getNavigationTiming = (): Omit<PerformanceData, 'fp' | 'fcp' | 'lcp' | 'cls' | 'fid' | 'inp'> => {
  const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  if (!nav) return { dns: 0, tcp: 0, ssl: 0, ttfb: 0, download: 0, domReady: 0, load: 0, transferSize: 0 }
  return {
    dns: round(nav.domainLookupEnd - nav.domainLookupStart),
    tcp: round(nav.connectEnd - nav.connectStart),
    ssl: nav.secureConnectionStart > 0 ? round(nav.connectEnd - nav.secureConnectionStart) : 0,
    ttfb: round(nav.responseStart - nav.requestStart),
    download: round(nav.responseEnd - nav.responseStart),
    domReady: round(nav.domContentLoadedEventEnd - nav.fetchStart),
    load: round(nav.loadEventEnd - nav.fetchStart),
    transferSize: nav.transferSize ?? 0
  }
}

type EntryHandler = (entries: PerformanceEntry[]) => void

const observe = (type: string, handler: EntryHandler): void => {
  const Observer = window.PerformanceObserver
  if (typeof Observer !== 'function') return
  if (Array.isArray(Observer.supportedEntryTypes) && !Observer.supportedEntryTypes.includes(type)) return
  try {
    const observer = new Observer((list) => { handler(list.getEntries()); })
    observer.observe({ type, buffered: true })
  } catch {
    // 浏览器不支持该 entry 类型时忽略
  }
}

// 采集导航耗时与 Web Vitals，在页面首次隐藏或卸载时上报一次
export const startPerformance = (report: Reporter) => {
  const vitals: Pick<PerformanceData, 'fp' | 'fcp' | 'lcp' | 'cls' | 'fid' | 'inp'> = {}
  let cls = 0
  let reported = false

  observe('paint', (entries) => {
    entries.forEach((entry) => {
      if (entry.name === 'first-paint') vitals.fp = round(entry.startTime)
      if (entry.name === 'first-contentful-paint') vitals.fcp = round(entry.startTime)
    })
  })
  observe('largest-contentful-paint', (entries) => {
    const last = entries[entries.length - 1]
    if (last) vitals.lcp = round(last.startTime)
  })
  observe('layout-shift', (entries) => {
    entries.forEach((entry) => {
      const shift = entry as PerformanceEntry & { value: number, hadRecentInput: boolean }
      if (!shift.hadRecentInput) cls += shift.value
    })
    vitals.cls = round(cls)
  })
  observe('first-input', (entries) => {
    const first = entries[0] as (PerformanceEntry & { processingStart: number }) | undefined
    if (first && vitals.fid === undefined) vitals.fid = round(first.processingStart - first.startTime)
  })
  observe('event', (entries) => {
    entries.forEach((entry) => {
      const interaction = entry as PerformanceEntry & { interactionId?: number }
      if (!interaction.interactionId) return
      vitals.inp = Math.max(vitals.inp ?? 0, round(entry.duration))
    })
  })

  const flush = () => {
    if (reported) return
    reported = true
    report({ ...getNavigationTiming(), ...vitals })
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}
