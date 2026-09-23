import { vi } from 'vitest'
import type { DevicesStats, ErrorsStats, EventsPage, GlobalStats, OverviewStats, PagesStats, PerformanceStats, SourcesStats, StatsKpi, VisitorDetail, VisitorsStats } from '@fanta/shared'
import type { Filters } from '../src/state/filters'

export const filtersFixture: Filters = { app: 'demo', preset: '7d', bots: 'exclude', tagged: 'exclude', from: Date.parse('2026-09-16T00:00:00Z'), to: Date.parse('2026-09-22T12:00:00Z') }
// 页面组件的公共 props（除 filters 外）
export const pageProps = { reloadKey: 0, onFilter: vi.fn(), visitor: null }

const kpi = (pv: number): StatsKpi => ({ pv, uv: Math.ceil(pv / 2), sessions: pv, users: 1, errors: 1, errorRate: pv > 0 ? 1 / pv : 0, botPv: 2, totalPv: pv + 2, bounceRate: 0.4, avgVisitDuration: 95, excludedVisitors: pv > 0 ? 1 : 0 })

export const overviewFixture: OverviewStats = {
  granularity: 'day',
  current: kpi(1234),
  previous: kpi(1000),
  series: [
    { bucket: '2026-09-20T00:00:00.000Z', pv: 400, uv: 200, errors: 1 },
    { bucket: '2026-09-21T00:00:00.000Z', pv: 834, uv: 417, errors: 0 }
  ]
}

export const emptyOverview: OverviewStats = {
  granularity: 'day',
  current: kpi(0),
  previous: kpi(0),
  series: []
}

export const pagesFixture: PagesStats = {
  paths: [{ path: '/', pv: 800, uv: 400 }, { path: '/pricing', pv: 434, uv: 217 }],
  entries: [{ path: '/', sessions: 900 }],
  referrers: [{ host: '(direct)', sessions: 600 }, { host: 'google.com', sessions: 300 }],
  hosts: [{ host: 'https://demo.example.com', pv: 1234, uv: 617 }]
}

export const globalFixture: GlobalStats = {
  granularity: 'day',
  apps: [
    { app: 'demo', current: kpi(1234), previous: kpi(1000), series: [{ bucket: '2026-09-20T00:00:00.000Z', pv: 400, uv: 200 }, { bucket: '2026-09-21T00:00:00.000Z', pv: 834, uv: 417 }] },
    { app: 'blog', current: kpi(300), previous: kpi(0), series: [{ bucket: '2026-09-20T00:00:00.000Z', pv: 100, uv: 50 }, { bucket: '2026-09-21T00:00:00.000Z', pv: 200, uv: 100 }] }
  ]
}

export const sourcesFixture: SourcesStats = {
  referrers: [{ host: '(direct)', sessions: 600 }, { host: 'google.com', sessions: 300 }],
  utmSource: [{ name: 'wechat', uv: 20, pv: 40 }],
  utmMedium: [{ name: 'social', uv: 20, pv: 40 }],
  utmCampaign: []
}

export const visitorsFixture: VisitorsStats = {
  visitors: [
    { visitorKey: 'uuid-aaaa-1111', tag: { visitorKey: 'uuid-aaaa-1111', label: '本人', isExcluded: true, note: '', updatedAt: '2026-09-21T01:00:00.000Z' }, firstSeen: '2026-09-20T01:00:00.000Z', lastSeen: '2026-09-21T01:00:00.000Z', sessions: 3, pv: 12, userIds: ['lion'], geo: { country: '中国', province: '广东省', city: '深圳市' }, browser: 'Chrome', os: 'Mac OS X', deviceType: 'Desktop' },
    { visitorKey: 'uuid-bbbb-2222', tag: null, firstSeen: '2026-09-20T02:00:00.000Z', lastSeen: '2026-09-20T02:30:00.000Z', sessions: 1, pv: 2, userIds: [], geo: { country: '内网', province: '', city: '' }, browser: 'Safari', os: 'iOS', deviceType: 'Mobile' }
  ]
}


export const devicesFixture: DevicesStats = {
  deviceType: [{ name: 'Desktop', uv: 300, pv: 800 }, { name: 'Mobile', uv: 100, pv: 434 }],
  os: [{ name: 'Mac OS X', uv: 300, pv: 800 }],
  browser: [{ name: 'Chrome', uv: 400, pv: 1234 }],
  screen: [{ name: '1920x1080', uv: 400, pv: 1234 }],
  network: [{ name: '4g', uv: 400, pv: 1234 }],
  language: [{ name: 'zh-CN', uv: 400, pv: 1234 }],
  geo: {
    country: [{ name: '中国', uv: 380, pv: 1200 }, { name: 'United States', uv: 20, pv: 34 }],
    province: [{ name: '广东省', uv: 200, pv: 700 }, { name: '北京市', uv: 180, pv: 500 }, { name: 'California', uv: 20, pv: 34 }],
    city: [{ name: '深圳市', uv: 200, pv: 700 }, { name: '北京市', uv: 180, pv: 500 }]
  },
  bots: { realUv: 400, realPv: 1234, botUv: 3, botPv: 2, verdicts: [{ verdict: 'ua', pv: 2 }], agents: [{ name: 'Googlebot/2.1', pv: 2 }] }
}

const summary = (p75: number, samples = 10) => ({ p50: p75 * 0.8, p75, p95: p75 * 1.2, samples, good: 6, needsImprovement: 3, poor: 1 })
export const performanceFixture: PerformanceStats = {
  granularity: 'day',
  metrics: {
    lcp: summary(2750),
    fcp: summary(1200),
    cls: { p50: 0.02, p75: 0.05, p95: 0.3, samples: 10, good: 8, needsImprovement: 1, poor: 1 },
    inp: summary(650),
    fid: summary(40),
    ttfb: summary(500),
    load: { ...summary(3000), good: 0, needsImprovement: 0, poor: 0 },
    domReady: { p50: null, p75: null, p95: null, samples: 0, good: 0, needsImprovement: 0, poor: 0 }
  },
  series: [{ bucket: '2026-09-20T00:00:00.000Z', lcp: 2750, fcp: 1200, inp: 650 }],
  pages: [{ path: '/', samples: 10, lcp: 2750, fcp: 1200, inp: 650 }]
}

export const errorsFixture: ErrorsStats = {
  granularity: 'day',
  total: 12,
  affectedUsers: 4,
  errorRate: 0.01,
  series: [{ bucket: '2026-09-20T00:00:00.000Z', errors: 12 }],
  groups: [
    { kind: 'js', message: 'boom', count: 10, users: 3, firstSeen: '2026-09-20T01:00:00.000Z', lastSeen: '2026-09-21T01:00:00.000Z', lastPath: '/pricing' },
    { kind: 'promise', message: 'rejected', count: 2, users: 1, firstSeen: '2026-09-20T01:00:00.000Z', lastSeen: '2026-09-20T01:00:00.000Z', lastPath: '/' }
  ]
}

export const eventsFixture = (offset: number): EventsPage => ({
  total: 120,
  items: Array.from({ length: 50 }, (_, i) => ({
    id: 1000 - offset - i,
    trackId: `t-${offset + i}`,
    trackTime: '2026-09-21T01:00:00.000Z',
    trackType: 'PageView' as const,
    path: `/p${offset + i}`,
    userId: '',
    visitor: 'fpA',
    sessionId: 'sA',
    deviceType: 'Desktop',
    browser: 'Chrome',
    os: 'Mac OS X',
    botVerdict: 'none' as const,
    tag: i === 0 ? { visitorKey: 'fpA', label: '同事', isExcluded: false, note: '', updatedAt: '2026-09-21T01:00:00.000Z' } : null,
    geo: i % 3 === 0 ? { country: '中国', province: '广东省', city: '深圳市' } : i % 3 === 1 ? { country: '内网', province: '', city: '' } : { country: '', province: '', city: '' },
    trackData: { trigger: 'init' }
  }))
})

export const visitorDetailFixture: VisitorDetail = {
  profile: { ...visitorsFixture.visitors[1], lifetimeFirstSeen: '2026-09-01T00:00:00.000Z', lifetimeSessions: 5, apps: ['demo', 'blog'] },
  events: eventsFixture(0).items.slice(0, 3)
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

// 按路径分发的 fetch 桩；统计接口去掉 /v1/stats 前缀，其余接口（如 /v1/visitors/:key/tag）按完整路径匹配；未覆盖的路径返回 404
export type RouteValue = unknown | ((url: URL) => unknown)
export const mockStatsFetch = (routes: Record<string, RouteValue>) => {
  return vi.spyOn(window, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost')
    const path = url.pathname.startsWith('/v1/stats') ? url.pathname.replace('/v1/stats', '') : url.pathname
    if (path in routes) {
      const value = routes[path]
      return json(typeof value === 'function' ? (value as (u: URL) => unknown)(url) : value)
    }
    return new Response('{"error":"not_found"}', { status: 404 })
  })
}

export const APPS = { apps: ['demo'] }
