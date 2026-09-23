import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Pool } from 'pg'
import type { DevicesStats, ErrorsStats, EventsPage, GlobalStats, OverviewStats, PagesStats, PerformanceStats, SourcesStats, VisitorDetail, VisitorTag, VisitorsStats } from '@fanta/shared'
import { buildApp } from '../src/app.js'
import { migrateUp } from '../src/migrations.js'
import { seedDatabase, T0, DAY, HOUR, GOOGLEBOT_UA, CHROME_UA } from './seed.js'
import { stubGeoResolver } from './helpers.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('缺少 TEST_DATABASE_URL，服务端集成测试需要真实 PostgreSQL')

const TOKEN = 'secret-token'
const pool = new Pool({ connectionString: databaseUrl })
const baseConfig = { databaseUrl, port: 0, allowedApps: new Set(['demo']), corsOrigin: '*', trustProxy: false, logLevel: 'silent', statsTimezone: 'UTC', geoXdbDir: '/nonexistent' }
const app = buildApp({ ...baseConfig, adminToken: TOKEN }, pool, stubGeoResolver)

const range = { from: T0, to: T0 + 3 * DAY }
const get = async (path: string, query: Record<string, string | number> = {}, token: string | null = TOKEN) => await app.inject({
  method: 'GET',
  url: `/v1/stats/${path}`,
  query: Object.fromEntries(Object.entries({ app: 'demo', ...range, ...query }).map(([k, v]) => [k, String(v)])),
  headers: token ? { authorization: `Bearer ${token}` } : {}
})

const iso = (ms: number) => new Date(ms).toISOString()

beforeAll(async () => {
  await migrateUp(pool)
  await seedDatabase(pool)
  await app.ready()
})
afterAll(async () => {
  await app.close()
  await pool.end()
})

describe('鉴权与参数校验', () => {
  it('缺少 token 返回 401', async () => {
    expect((await get('overview', {}, null)).statusCode).toBe(401)
  })

  it('错误 token 返回 401', async () => {
    expect((await get('overview', {}, 'wrong')).statusCode).toBe(401)
  })

  it('app 不在白名单返回 403', async () => {
    expect((await get('overview', { app: 'evil' })).statusCode).toBe(403)
  })

  it('缺少 from 返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/stats/overview', query: { app: 'demo', to: String(T0) }, headers: { authorization: `Bearer ${TOKEN}` } })
    expect(res.statusCode).toBe(400)
  })

  it('to 不大于 from 返回 400', async () => {
    expect((await get('overview', { from: T0, to: T0 })).statusCode).toBe(400)
  })

  it('bots 取值非法返回 400', async () => {
    expect((await get('overview', { bots: 'maybe' })).statusCode).toBe(400)
  })
})

describe('未配置 ADMIN_TOKEN', () => {
  it('统计接口与后台页面都不注册', async () => {
    const bare = buildApp(baseConfig, pool, null)
    await bare.ready()
    expect((await bare.inject({ method: 'GET', url: '/v1/stats/apps', headers: { authorization: `Bearer ${TOKEN}` } })).statusCode).toBe(404)
    expect((await bare.inject({ method: 'GET', url: '/admin/' })).statusCode).toBe(404)
    await bare.close()
  })
})

describe('GET /admin/', () => {
  it('配置 token 后托管后台首页，深链接回退到 index.html', async () => {
    const home = await app.inject({ method: 'GET', url: '/admin/' })
    expect(home.statusCode).toBe(200)
    expect(home.headers['content-type']).toContain('text/html')
    const deep = await app.inject({ method: 'GET', url: '/admin/some/deep/link' })
    expect(deep.statusCode).toBe(200)
    expect(deep.body).toBe(home.body)
  })
})

describe('GET /sdk/', () => {
  it('公开托管 SDK UMD 产物，不需要 token，带短缓存', async () => {
    const res = await app.inject({ method: 'GET', url: '/sdk/fanta-report.umd.js' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('javascript')
    expect(res.headers['cache-control']).toBe('public, max-age=300')
    expect(res.body).toContain('FantaReport')
    expect((await app.inject({ method: 'GET', url: '/sdk/nope.js' })).statusCode).toBe(404)
  })
})

describe('GET /v1/stats/apps', () => {
  it('返回白名单内有数据的应用', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/stats/apps', headers: { authorization: `Bearer ${TOKEN}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ apps: ['demo'] })
  })
})

describe('GET /v1/stats/overview', () => {
  it('维度下钻：browser=Safari 只剩访客 B；地域 city 也可过滤；多维度取交集', async () => {
    const safari: OverviewStats = (await get('overview', { browser: 'Safari' })).json()
    expect(safari.current).toMatchObject({ pv: 2, uv: 1, sessions: 2 })
    const shenzhen: OverviewStats = (await get('overview', { city: '深圳市' })).json()
    expect(shenzhen.current).toMatchObject({ pv: 2, uv: 1 })
    const none: OverviewStats = (await get('overview', { browser: 'Safari', city: '深圳市' })).json()
    expect(none.current).toMatchObject({ pv: 0, uv: 0 })
    const pages: PagesStats = (await get('pages', { referrerHost: 'google.com' })).json()
    expect(pages.paths.map((p) => p.path)).toEqual(['/', '/pricing'])
  })

  it('tagged 取值非法返回 400', async () => {
    expect((await get('overview', { tagged: 'maybe' })).statusCode).toBe(400)
  })

  it('默认排除爬虫，KPI 与按天序列正确', async () => {
    const res = await get('overview')
    expect(res.statusCode).toBe(200)
    const body: OverviewStats = res.json()
    expect(body.granularity).toBe('day')
    // 会话 sA 两次 PV 停留 3900s；sE / sB / sB2 各一次 PV 视为跳出，sB 停留 900s
    expect(body.current).toEqual({ pv: 5, uv: 3, sessions: 4, users: 1, errors: 3, errorRate: 0.6, botPv: 3, totalPv: 8, bounceRate: 0.75, avgVisitDuration: 1200, excludedVisitors: 0 })
    expect(body.previous).toEqual({ pv: 0, uv: 0, sessions: 0, users: 0, errors: 0, errorRate: 0, botPv: 0, totalPv: 0, bounceRate: 0, avgVisitDuration: 0, excludedVisitors: 0 })
    expect(body.series).toEqual([
      { bucket: iso(T0), pv: 3, uv: 2, errors: 1 },
      { bucket: iso(T0 + DAY), pv: 1, uv: 1, errors: 2 },
      { bucket: iso(T0 + 2 * DAY), pv: 1, uv: 1, errors: 0 }
    ])
  })

  it('bots=include 计入爬虫，bots=only 仅爬虫', async () => {
    const include: OverviewStats = (await get('overview', { bots: 'include' })).json()
    expect(include.current).toMatchObject({ pv: 8, uv: 5, sessions: 6, errors: 3 })
    const only: OverviewStats = (await get('overview', { bots: 'only' })).json()
    expect(only.current).toMatchObject({ pv: 3, uv: 2, sessions: 2, errors: 0, errorRate: 0 })
  })

  it('区间不超过 48 小时按小时分桶并补零', async () => {
    const body: OverviewStats = (await get('overview', { from: T0, to: T0 + 3 * HOUR })).json()
    expect(body.granularity).toBe('hour')
    expect(body.series.map((s) => s.pv)).toEqual([0, 1, 2])
  })
})

describe('GET /v1/stats/pages', () => {
  it('返回路径排名、入口页与来源', async () => {
    const body: PagesStats = (await get('pages')).json()
    expect(body.paths).toEqual([
      { path: '/', pv: 2, uv: 2 },
      { path: '/pricing', pv: 2, uv: 2 },
      { path: '/about', pv: 1, uv: 1 }
    ])
    expect(body.entries).toEqual([
      { path: '/', sessions: 2 },
      { path: '/about', sessions: 1 },
      { path: '/pricing', sessions: 1 }
    ])
    expect(body.referrers).toEqual([
      { host: '(direct)', sessions: 2 },
      { host: 'google.com', sessions: 1 },
      { host: 'twitter.com', sessions: 1 }
    ])
  })

  it('limit 生效', async () => {
    const body: PagesStats = (await get('pages', { limit: 1 })).json()
    expect(body.paths).toHaveLength(1)
  })
})

describe('GET /v1/stats/devices', () => {
  it('六组分布按 UV 排序，爬虫面板不受 bots 参数影响', async () => {
    const body: DevicesStats = (await get('devices')).json()
    expect(body.deviceType).toEqual([{ name: 'Desktop', uv: 2, pv: 3 }, { name: 'Mobile', uv: 1, pv: 2 }])
    expect(body.os).toEqual([{ name: 'Mac OS X', uv: 2, pv: 3 }, { name: 'iOS', uv: 1, pv: 2 }])
    expect(body.browser).toEqual([{ name: 'Chrome', uv: 2, pv: 3 }, { name: 'Safari', uv: 1, pv: 2 }])
    expect(body.screen).toEqual([{ name: '1920x1080', uv: 2, pv: 3 }, { name: '390x844', uv: 1, pv: 2 }])
    expect(body.network).toEqual([{ name: '4g', uv: 3, pv: 5 }])
    expect(body.language).toEqual([{ name: 'zh-CN', uv: 2, pv: 3 }, { name: 'en-US', uv: 1, pv: 2 }])
    expect(body.bots).toEqual({
      realUv: 3,
      realPv: 5,
      botUv: 2,
      botPv: 3,
      verdicts: [{ verdict: 'ua', pv: 2 }, { verdict: 'webdriver', pv: 1 }],
      agents: [{ name: GOOGLEBOT_UA, pv: 2 }, { name: CHROME_UA, pv: 1 }]
    })
  })

  it('地域三级分布；省/市为空时回退到上一级名称', async () => {
    const body: DevicesStats = (await get('devices')).json()
    expect(body.geo.country).toEqual([{ name: '中国', uv: 2, pv: 4 }, { name: 'United States', uv: 1, pv: 1 }])
    // 广东省与北京市 UV/PV 相同，排序取决于数据库排序规则，不断言先后
    expect(body.geo.province).toHaveLength(3)
    expect(body.geo.province).toEqual(expect.arrayContaining([
      { name: '广东省', uv: 1, pv: 2 }, { name: '北京市', uv: 1, pv: 2 }, { name: 'California', uv: 1, pv: 1 }
    ]))
    expect(body.geo.city).toHaveLength(3)
    expect(body.geo.city).toEqual(expect.arrayContaining([
      { name: '深圳市', uv: 1, pv: 2 }, { name: '北京市', uv: 1, pv: 2 }, { name: 'California', uv: 1, pv: 1 }
    ]))
  })

  it('仅爬虫时地域为内网', async () => {
    const body: DevicesStats = (await get('devices', { bots: 'only' })).json()
    expect(body.geo.country).toEqual([{ name: '内网', uv: 2, pv: 3 }])
    expect(body.geo.city).toEqual([{ name: '内网', uv: 2, pv: 3 }])
  })
})

describe('GET /v1/stats/performance', () => {
  it('分位数、评级计数、趋势与按页面表', async () => {
    const body: PerformanceStats = (await get('performance')).json()
    expect(body.metrics.lcp).toEqual({ p50: 2500, p75: 2750, p95: 2950, samples: 2, good: 1, needsImprovement: 1, poor: 0 })
    expect(body.metrics.cls).toMatchObject({ samples: 2, good: 1, needsImprovement: 0, poor: 1 })
    expect(body.metrics.inp).toMatchObject({ samples: 2, good: 1, needsImprovement: 0, poor: 1 })
    expect(body.metrics.fcp).toMatchObject({ samples: 2, good: 1, needsImprovement: 1, poor: 0 })
    expect(body.metrics.fid).toEqual({ p50: 50, p75: 50, p95: 50, samples: 1, good: 1, needsImprovement: 0, poor: 0 })
    expect(body.metrics.load).toEqual({ p50: 1500, p75: 1500, p95: 1500, samples: 1, good: 0, needsImprovement: 0, poor: 0 })
    expect(body.metrics.ttfb.samples).toBe(1)
    // 驼峰指标名会被 PostgreSQL 折叠为小写列名，这里确保仍能正确回填
    expect(body.metrics.domReady).toEqual({ p50: 1000, p75: 1000, p95: 1000, samples: 1, good: 0, needsImprovement: 0, poor: 0 })
    expect(body.series).toEqual([
      { bucket: iso(T0), lcp: 2000, fcp: 1000, inp: 150 },
      { bucket: iso(T0 + DAY), lcp: 3000, fcp: 2000, inp: 600 },
      { bucket: iso(T0 + 2 * DAY), lcp: null, fcp: null, inp: null }
    ])
    expect(body.pages).toEqual([{ path: '/', samples: 2, lcp: 2750, fcp: 1750, inp: 487.5 }])
  })

  it('没有样本时分位数为 null', async () => {
    const body: PerformanceStats = (await get('performance', { bots: 'only' })).json()
    expect(body.metrics.lcp).toEqual({ p50: null, p75: null, p95: null, samples: 0, good: 0, needsImprovement: 0, poor: 0 })
    expect(body.pages).toEqual([])
  })
})

describe('GET /v1/stats/errors', () => {
  it('错误分组、影响用户与趋势', async () => {
    const body: ErrorsStats = (await get('errors')).json()
    expect(body).toMatchObject({ total: 3, affectedUsers: 2, errorRate: 0.6 })
    expect(body.series.map((s) => s.errors)).toEqual([1, 2, 0])
    expect(body.groups).toEqual([
      { kind: 'js', message: 'boom', count: 2, users: 2, firstSeen: iso(T0 + 2 * HOUR + 5 * 60_000), lastSeen: iso(T0 + DAY + HOUR + 10 * 60_000), lastPath: '/' },
      { kind: 'promise', message: 'rejected', count: 1, users: 1, firstSeen: iso(T0 + DAY + HOUR + 15 * 60_000), lastSeen: iso(T0 + DAY + HOUR + 15 * 60_000), lastPath: '/' }
    ])
  })

  it('occurrences 返回某组最近明细', async () => {
    const res = await get('errors/occurrences', { kind: 'js', message: 'boom' })
    expect(res.statusCode).toBe(200)
    const items = res.json().items
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ path: '/', browser: 'Safari', os: 'iOS', userId: '', visitor: 'uB' })
    expect(items[0].trackData.stack).toBe('Error: boom\n  at b.js:1')
    expect(items[1]).toMatchObject({ path: '/pricing', browser: 'Chrome', userId: 'u1', visitor: 'uA' })
  })

  it('occurrences 缺少 kind 返回 400', async () => {
    expect((await get('errors/occurrences', { message: 'boom' })).statusCode).toBe(400)
  })
})

describe('GET /v1/stats/events', () => {
  it('默认排除爬虫，倒序分页', async () => {
    const body: EventsPage = (await get('events', { limit: 5 })).json()
    expect(body.total).toBe(11)
    expect(body.items).toHaveLength(5)
    expect(body.items[0]).toMatchObject({ trackType: 'PageView', path: '/pricing', sessionId: 'sB2', botVerdict: 'none', geo: { country: '中国', province: '北京市', city: '北京市' } })
    const tail: EventsPage = (await get('events', { limit: 5, offset: 10 })).json()
    expect(tail.items).toHaveLength(1)
    expect(tail.items[0]).toMatchObject({ trackType: 'PageView', path: '/', sessionId: 'sA', geo: { country: '中国', province: '广东省', city: '深圳市' } })
  })

  it('按类型、关键词、路径过滤', async () => {
    expect(((await get('events', { type: 'PageView' })).json() as EventsPage).total).toBe(5)
    expect(((await get('events', { q: 'u1' })).json() as EventsPage).total).toBe(5)
    expect(((await get('events', { q: 'sB2' })).json() as EventsPage).total).toBe(1)
    expect(((await get('events', { path: '/pricing' })).json() as EventsPage).total).toBe(3)
    expect(((await get('events', { bots: 'include' })).json() as EventsPage).total).toBe(14)
  })

  it('非法 type 与超限 offset 返回 400', async () => {
    expect((await get('events', { type: 'Nope' })).statusCode).toBe(400)
    expect((await get('events', { offset: 10001 })).statusCode).toBe(400)
  })
})

describe('GET /v1/stats/global', () => {
  it('按白名单 app 分组返回 KPI 与 PV/UV 序列，不需要 app 参数', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/stats/global', query: { from: String(T0), to: String(T0 + 3 * DAY) }, headers: { authorization: `Bearer ${TOKEN}` } })
    expect(res.statusCode).toBe(200)
    const body: GlobalStats = res.json()
    expect(body.granularity).toBe('day')
    expect(body.apps).toHaveLength(1)
    expect(body.apps[0].app).toBe('demo')
    expect(body.apps[0].current).toMatchObject({ pv: 5, uv: 3, sessions: 4, bounceRate: 0.75, avgVisitDuration: 1200 })
    expect(body.apps[0].previous.pv).toBe(0)
    expect(body.apps[0].series.map((s) => [s.pv, s.uv])).toEqual([[3, 2], [1, 1], [1, 1]])
  })

  it('缺少 from 返回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/stats/global', query: { to: String(T0) }, headers: { authorization: `Bearer ${TOKEN}` } })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /v1/stats/sources', () => {
  it('来源按会话首个 PageView 的 referrer 域名聚合，UTM 按列聚合', async () => {
    const body: SourcesStats = (await get('sources')).json()
    expect(body.referrers).toEqual([{ host: '(direct)', sessions: 2 }, { host: 'google.com', sessions: 1 }, { host: 'twitter.com', sessions: 1 }])
    expect(body.utmSource).toEqual([{ name: 'wechat', uv: 1, pv: 1 }])
    expect(body.utmMedium).toEqual([{ name: 'social', uv: 1, pv: 1 }])
    expect(body.utmCampaign).toEqual([])
  })
})

describe('访客与标记', () => {
  const tagUrl = (key: string) => `/v1/visitors/${key}/tag`
  const putTag = async (key: string, body: unknown) => await app.inject({ method: 'PUT', url: tagUrl(key), payload: body, headers: { authorization: `Bearer ${TOKEN}` } })

  it('访客列表按最近访问倒序，含会话/PV/userId/最近设备与地域', async () => {
    const body: VisitorsStats = (await get('visitors')).json()
    expect(body.visitors.map((v) => v.visitorKey)).toEqual(['uB', 'uA', 'uE'])
    expect(body.visitors[0]).toMatchObject({ sessions: 2, pv: 2, userIds: [], browser: 'Safari', geo: { city: '北京市' }, tag: null })
    expect(body.visitors[1]).toMatchObject({ sessions: 1, pv: 2, userIds: ['u1'], firstSeen: iso(T0 + HOUR) })
  })

  it('访客详情含全时段画像与事件时间线；不存在返回 404', async () => {
    const res = await get('visitors/uA')
    expect(res.statusCode).toBe(200)
    const body: VisitorDetail = res.json()
    expect(body.profile).toMatchObject({ visitorKey: 'uA', lifetimeSessions: 1, apps: ['demo'], lifetimeFirstSeen: iso(T0 + HOUR) })
    expect(body.events).toHaveLength(5)
    expect(body.events.every((e) => e.visitor === 'uA')).toBe(true)
    expect((await get('visitors/nobody')).statusCode).toBe(404)
  })

  it('标记 label 为空或缺少 isExcluded 返回 400；未鉴权 401', async () => {
    expect((await putTag('uA', { label: '', isExcluded: true })).statusCode).toBe(400)
    expect((await putTag('uA', { label: '本人' })).statusCode).toBe(400)
    expect((await app.inject({ method: 'PUT', url: tagUrl('uA'), payload: { label: '本人', isExcluded: true } })).statusCode).toBe(401)
  })

  it('打标并排除后统计不再计入该访客，tagged=include 恢复，删除后还原', async () => {
    const created = await putTag('uA', { label: '本人', isExcluded: true, note: '我自己的电脑' })
    expect(created.statusCode).toBe(200)
    const tag: VisitorTag = created.json()
    expect(tag).toMatchObject({ visitorKey: 'uA', label: '本人', isExcluded: true, note: '我自己的电脑' })

    const excluded: OverviewStats = (await get('overview')).json()
    expect(excluded.current).toMatchObject({ pv: 3, uv: 2, sessions: 3, users: 0, excludedVisitors: 1 })
    const included: OverviewStats = (await get('overview', { tagged: 'include' })).json()
    expect(included.current).toMatchObject({ pv: 5, uv: 3, excludedVisitors: 1 })

    const events: EventsPage = (await get('events', { tagged: 'include', q: 'uA' })).json()
    expect(events.items[0].tag).toMatchObject({ label: '本人', isExcluded: true })
    const visitors: VisitorsStats = (await get('visitors', { tagged: 'include' })).json()
    expect(visitors.visitors.find((v) => v.visitorKey === 'uA')?.tag?.label).toBe('本人')
    expect((await get('visitors')).json().visitors.map((v: { visitorKey: string }) => v.visitorKey)).toEqual(['uB', 'uE'])

    // 改为不排除：仍显示标签但重新计入
    await putTag('uA', { label: '本人', isExcluded: false })
    expect(((await get('overview')).json() as OverviewStats).current).toMatchObject({ uv: 3, excludedVisitors: 0 })

    expect((await app.inject({ method: 'DELETE', url: tagUrl('uA'), headers: { authorization: `Bearer ${TOKEN}` } })).statusCode).toBe(204)
    expect((await app.inject({ method: 'DELETE', url: tagUrl('uA'), headers: { authorization: `Bearer ${TOKEN}` } })).statusCode).toBe(404)
    expect(((await get('events', { q: 'uA' })).json() as EventsPage).items[0].tag).toBeNull()
  })
})
