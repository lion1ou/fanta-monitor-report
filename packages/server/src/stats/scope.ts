import { BOTS_MODES, DIMENSION_KEYS, TAGGED_MODES, type BotsMode, type DimensionFilters, type DimensionKey, type Granularity, type TaggedMode } from '@fanta/shared'

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000
const HOUR_GRANULARITY_MAX_MS = 48 * 60 * 60 * 1000

const dimensionProperties = Object.fromEntries(DIMENSION_KEYS.map((key) => [key, { type: 'string', maxLength: 500 }])) as Record<DimensionKey, { type: 'string', maxLength: 500 }>

// 所有统计接口共用的 querystring 契约
export const statsQuerySchema = {
  type: 'object',
  required: ['app', 'from', 'to'],
  properties: {
    app: { type: 'string', minLength: 1 },
    from: { type: 'integer' },
    to: { type: 'integer' },
    bots: { type: 'string', enum: BOTS_MODES },
    tagged: { type: 'string', enum: TAGGED_MODES },
    limit: { type: 'integer', minimum: 1 },
    ...dimensionProperties
  }
} as const

export interface StatsQuery extends DimensionFilters {
  app: string
  from: number
  to: number
  bots?: BotsMode
  tagged?: TaggedMode
  limit?: number
}

export class StatsError extends Error {
  constructor (public readonly statusCode: number, message: string) {
    super(message)
  }
}

// 爬虫过滤条件以白名单映射为固定 SQL 片段，不拼接用户输入
const BOTS_CONDITION: Record<BotsMode, string> = {
  exclude: "bot_verdict = 'none'",
  include: 'TRUE',
  only: "bot_verdict <> 'none'"
}

const EXCLUDED_VISITORS_CONDITION = 'visitor_key NOT IN (SELECT visitor_key FROM visitor_tags WHERE is_excluded)'

// 来源域名：从 referrer 取协议后的主机部分
export const REFERRER_HOST_EXPR = "substring(referrer from '^[a-z]+://([^/]+)')"

// 维度下钻：键 → 列/表达式，值统一从 $4 jsonb 参数取，SQL 文本不含用户输入
const DIMENSION_EXPR: Record<DimensionKey, string> = {
  path: 'page_path',
  referrerHost: REFERRER_HOST_EXPR,
  browser: 'browser',
  os: 'os',
  deviceType: 'device_type',
  country: 'geo_country',
  province: 'geo_province',
  city: 'geo_city',
  language: 'language'
}

// UV 口径：uuid（跨站 cookie 共享）优先，canvas 指纹兜底；对应生成列 visitor_key
export const VISITOR_EXPR = 'visitor_key'

export interface Scope {
  app: string
  from: Date
  to: Date
  bots: BotsMode
  tagged: TaggedMode
  dimensions: DimensionFilters
  granularity: Granularity
  timezone: string
  // 爬虫 + 标记访客 + 维度过滤的合并条件；依赖 $4 为维度 jsonb
  filterCondition: string
}

const pickDimensions = (query: DimensionFilters): DimensionFilters =>
  Object.fromEntries(DIMENSION_KEYS.flatMap((key) => query[key] !== undefined && query[key] !== '' ? [[key, query[key]]] : []))

export const resolveScope = (query: StatsQuery, timezone: string): Scope => {
  if (query.to <= query.from) throw new StatsError(400, 'to 必须大于 from')
  if (query.to - query.from > MAX_RANGE_MS) throw new StatsError(400, '时间范围不能超过 366 天')
  const bots = query.bots ?? 'exclude'
  const tagged = query.tagged ?? 'exclude'
  const dimensions = pickDimensions(query)
  // PG 要求每个绑定参数至少被引用一次，$4 维度 jsonb 在无下钻时也要出现
  const conditions = [
    '$4::jsonb IS NOT NULL',
    BOTS_CONDITION[bots],
    ...(tagged === 'exclude' ? [EXCLUDED_VISITORS_CONDITION] : []),
    ...(Object.keys(dimensions) as DimensionKey[]).map((key) => `${DIMENSION_EXPR[key]} = $4::jsonb ->> '${key}'`)
  ]
  return {
    app: query.app,
    from: new Date(query.from),
    to: new Date(query.to),
    bots,
    tagged,
    dimensions,
    granularity: query.to - query.from <= HOUR_GRANULARITY_MAX_MS ? 'hour' : 'day',
    timezone,
    filterCondition: conditions.join(' AND ')
  }
}

// 上一周期：与当前区间等长、紧邻其前
export const previousScope = (scope: Scope): Scope => {
  const span = scope.to.getTime() - scope.from.getTime()
  return { ...scope, from: new Date(scope.from.getTime() - span), to: new Date(scope.from) }
}

// 区间 + 过滤后的事件子集；参数固定为 $1 app、$2 from、$3 to、$4 维度 jsonb
export const scopedSql = (scope: Scope): string =>
  `SELECT *, ${VISITOR_EXPR} AS visitor FROM track_events WHERE app_name = $1 AND track_time >= $2 AND track_time < $3 AND ${scope.filterCondition}`

export const scopeParams = (scope: Scope): [string, Date, Date, string] => [scope.app, scope.from, scope.to, JSON.stringify(scope.dimensions)]

// 连续时间桶，补齐无数据的桶；依赖参数 $2 from、$3 to、$5 granularity、$6 timezone
export const bucketsSql = "SELECT generate_series(date_trunc($5, $2::timestamptz, $6), date_trunc($5, ($3::timestamptz - interval '1 millisecond'), $6), ('1 ' || $5)::interval) AS bucket"
export const bucketExpr = 'date_trunc($5, track_time, $6)'

export const limitOf = (query: StatsQuery, fallback: number, max: number): number => Math.min(query.limit ?? fallback, max)
