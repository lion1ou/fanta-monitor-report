import { BOTS_MODES, type BotsMode, type Granularity } from '@fanta/shared'

const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000
const HOUR_GRANULARITY_MAX_MS = 48 * 60 * 60 * 1000

// 所有统计接口共用的 querystring 契约
export const statsQuerySchema = {
  type: 'object',
  required: ['app', 'from', 'to'],
  properties: {
    app: { type: 'string', minLength: 1 },
    from: { type: 'integer' },
    to: { type: 'integer' },
    bots: { type: 'string', enum: BOTS_MODES },
    limit: { type: 'integer', minimum: 1 }
  }
} as const

export interface StatsQuery {
  app: string
  from: number
  to: number
  bots?: BotsMode
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

// UV 口径：优先 canvas 指纹，空指纹回退到设备 uuid
export const VISITOR_EXPR = "COALESCE(NULLIF(finger_print, ''), uuid)"

export interface Scope {
  app: string
  from: Date
  to: Date
  bots: BotsMode
  botsCondition: string
  granularity: Granularity
  timezone: string
}

export const resolveScope = (query: StatsQuery, timezone: string): Scope => {
  if (query.to <= query.from) throw new StatsError(400, 'to 必须大于 from')
  if (query.to - query.from > MAX_RANGE_MS) throw new StatsError(400, '时间范围不能超过 366 天')
  const bots = query.bots ?? 'exclude'
  return {
    app: query.app,
    from: new Date(query.from),
    to: new Date(query.to),
    bots,
    botsCondition: BOTS_CONDITION[bots],
    granularity: query.to - query.from <= HOUR_GRANULARITY_MAX_MS ? 'hour' : 'day',
    timezone
  }
}

// 上一周期：与当前区间等长、紧邻其前
export const previousScope = (scope: Scope): Scope => {
  const span = scope.to.getTime() - scope.from.getTime()
  return { ...scope, from: new Date(scope.from.getTime() - span), to: new Date(scope.from) }
}

// 区间 + 爬虫过滤后的事件子集；参数固定为 $1 app、$2 from、$3 to
export const scopedSql = (scope: Scope): string =>
  `SELECT *, ${VISITOR_EXPR} AS visitor FROM track_events WHERE app_name = $1 AND track_time >= $2 AND track_time < $3 AND ${scope.botsCondition}`

export const scopeParams = (scope: Scope): [string, Date, Date] => [scope.app, scope.from, scope.to]

// 连续时间桶，补齐无数据的桶；依赖参数 $2 from、$3 to、$4 granularity、$5 timezone
export const bucketsSql = "SELECT generate_series(date_trunc($4, $2::timestamptz, $5), date_trunc($4, ($3::timestamptz - interval '1 millisecond'), $5), ('1 ' || $4)::interval) AS bucket"
export const bucketExpr = 'date_trunc($4, track_time, $5)'

export const limitOf = (query: StatsQuery, fallback: number, max: number): number => Math.min(query.limit ?? fallback, max)
