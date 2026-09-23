import type { FromSchema } from 'json-schema-to-ts'

export const TRACK_TYPES = ['PageView', 'Click', 'Error', 'Custom', 'Performance'] as const
export type TrackType = (typeof TRACK_TYPES)[number]

export const TRACK_BATCH_MAX = 50

const text = { type: 'string' } as const
const int = { type: 'integer' } as const

// 单条事件契约：SDK 产出与服务端校验都以此为准
export const trackEventSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'trackId', 'trackType', 'trackTime', 'trackData',
    'appName', 'uuid', 'sessionId', 'sdkVersion', 'sdkEnv',
    'pageOrigin', 'pagePath', 'pageSearch', 'pageProtocol', 'pageTitle', 'referrer',
    'userAgent', 'deviceType', 'mobileBrand', 'mobileModel', 'os', 'osVersion',
    'browser', 'browserVersion', 'browserEngine', 'isBot', 'isWebview', 'language', 'orientation',
    'screenWidth', 'screenHeight', 'viewportWidth', 'viewportHeight',
    'networkType', 'networkEffectiveType', 'fingerPrint', 'fingerPrintCanvas'
  ],
  properties: {
    trackId: { type: 'string', minLength: 1, maxLength: 64 },
    trackType: { type: 'string', enum: TRACK_TYPES },
    trackTime: int,
    trackData: { type: 'object' },
    appName: { type: 'string', minLength: 1, maxLength: 100 },
    appVersion: text,
    userId: text,
    uuid: text,
    sessionId: text,
    sdkVersion: text,
    sdkEnv: text,
    pageOrigin: text,
    pagePath: text,
    pageSearch: text,
    pageProtocol: text,
    pageTitle: text,
    referrer: text,
    userAgent: text,
    deviceType: text,
    mobileBrand: text,
    mobileModel: text,
    os: text,
    osVersion: text,
    browser: text,
    browserVersion: text,
    browserEngine: text,
    isBot: { type: 'boolean' },
    isWebview: { type: 'boolean' },
    language: text,
    orientation: text,
    screenWidth: int,
    screenHeight: int,
    viewportWidth: int,
    viewportHeight: int,
    networkType: text,
    networkEffectiveType: text,
    fingerPrint: text,
    fingerPrintCanvas: text,
    coordinates: text,
    isWebdriver: { type: 'boolean' }
  }
} as const

export type TrackEvent = FromSchema<typeof trackEventSchema>

// 服务端爬虫判定结果，优先级从高到低
export const BOT_VERDICTS = ['webdriver', 'ua', 'sdk', 'none'] as const
export type BotVerdict = (typeof BOT_VERDICTS)[number]

// 统计查询中爬虫流量的处理方式
export const BOTS_MODES = ['exclude', 'include', 'only'] as const
export type BotsMode = (typeof BOTS_MODES)[number]

export type Granularity = 'hour' | 'day'

export const VITAL_METRICS = ['lcp', 'fcp', 'cls', 'inp', 'fid', 'ttfb', 'load', 'domReady'] as const
export type VitalMetric = (typeof VITAL_METRICS)[number]

// Web Vitals 官方阈值 [good 上限, needs-improvement 上限]；load / domReady 不评级
export const VITAL_THRESHOLDS: Partial<Record<VitalMetric, readonly [number, number]>> = {
  lcp: [2500, 4000],
  fcp: [1800, 3000],
  cls: [0.1, 0.25],
  inp: [200, 500],
  fid: [100, 300],
  ttfb: [800, 1800]
}

export interface StatsKpi {
  pv: number
  uv: number
  sessions: number
  users: number
  errors: number
  errorRate: number
  botPv: number
  totalPv: number
}

export interface OverviewStats {
  granularity: Granularity
  current: StatsKpi
  previous: StatsKpi
  series: Array<{ bucket: string, pv: number, uv: number, errors: number }>
}

export interface PagesStats {
  paths: Array<{ path: string, pv: number, uv: number }>
  entries: Array<{ path: string, sessions: number }>
  referrers: Array<{ host: string, sessions: number }>
}

export interface Distribution {
  name: string
  uv: number
  pv: number
}

// 服务端按 client_ip 解析出的地域；私有/保留地址 country 为「内网」，未命中三项均为空
export interface GeoRegion {
  country: string
  province: string
  city: string
}

export const GEO_INTERNAL = '内网'

export interface DevicesStats {
  deviceType: Distribution[]
  os: Distribution[]
  browser: Distribution[]
  screen: Distribution[]
  network: Distribution[]
  language: Distribution[]
  geo: Record<keyof GeoRegion, Distribution[]>
  bots: {
    realUv: number
    realPv: number
    botUv: number
    botPv: number
    verdicts: Array<{ verdict: BotVerdict, pv: number }>
    agents: Array<{ name: string, pv: number }>
  }
}

export interface MetricSummary {
  p50: number | null
  p75: number | null
  p95: number | null
  samples: number
  good: number
  needsImprovement: number
  poor: number
}

export interface PerformanceStats {
  granularity: Granularity
  metrics: Record<VitalMetric, MetricSummary>
  series: Array<{ bucket: string, lcp: number | null, fcp: number | null, inp: number | null }>
  pages: Array<{ path: string, samples: number, lcp: number | null, fcp: number | null, inp: number | null }>
}

export interface ErrorGroup {
  kind: string
  message: string
  count: number
  users: number
  firstSeen: string
  lastSeen: string
  lastPath: string
}

export interface ErrorsStats {
  granularity: Granularity
  total: number
  affectedUsers: number
  errorRate: number
  series: Array<{ bucket: string, errors: number }>
  groups: ErrorGroup[]
}

export interface ErrorOccurrence {
  trackId: string
  trackTime: string
  path: string
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  userId: string
  visitor: string
  trackData: Record<string, unknown>
}

export interface EventRow {
  id: number
  trackId: string
  trackTime: string
  trackType: TrackType
  path: string
  userId: string
  visitor: string
  sessionId: string
  deviceType: string
  browser: string
  os: string
  botVerdict: BotVerdict
  geo: GeoRegion
  trackData: Record<string, unknown>
}

export interface EventsPage {
  total: number
  items: EventRow[]
}

export const trackBatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: { type: 'array', minItems: 1, maxItems: TRACK_BATCH_MAX, items: trackEventSchema }
  }
} as const

export type TrackBatch = FromSchema<typeof trackBatchSchema>
