import type { Pool } from 'pg'
import type { OverviewStats, StatsKpi } from '@fanta/shared'
import { VISITOR_EXPR, bucketExpr, bucketsSql, previousScope, scopeParams, scopedSql, type Scope } from './scope.js'

export interface KpiRow {
  pv: number
  uv: number
  sessions: number
  users: number
  errors: number
  bot_pv: number
  total_pv: number
  bounced: number
  pv_sessions: number
  duration_sum: number
  excluded_visitors: number
}

// 会话级指标：每个会话的 PageView 数与首末事件间隔（秒）
const SESSION_METRICS_SQL = (scope: Scope) => `
SELECT session_id,
  count(*) FILTER (WHERE track_type = 'PageView')::int AS pv_count,
  extract(epoch FROM max(track_time) - min(track_time)) AS duration
FROM track_events
WHERE app_name = $1 AND track_time >= $2 AND track_time < $3 AND ${scope.filterCondition}
GROUP BY session_id`

// KPI 在全量区间上算，过滤条件放进 FILTER，使 botPv / totalPv / excludedVisitors 不受 bots、tagged 参数影响
export const KPI_SELECT = (scope: Scope) => `
  count(*) FILTER (WHERE track_type = 'PageView' AND ${scope.filterCondition})::int AS pv,
  count(DISTINCT ${VISITOR_EXPR}) FILTER (WHERE track_type = 'PageView' AND ${scope.filterCondition})::int AS uv,
  count(DISTINCT session_id) FILTER (WHERE ${scope.filterCondition})::int AS sessions,
  count(DISTINCT user_id) FILTER (WHERE user_id <> '' AND ${scope.filterCondition})::int AS users,
  count(*) FILTER (WHERE track_type = 'Error' AND ${scope.filterCondition})::int AS errors,
  count(*) FILTER (WHERE track_type = 'PageView' AND bot_verdict <> 'none')::int AS bot_pv,
  count(*) FILTER (WHERE track_type = 'PageView')::int AS total_pv,
  count(DISTINCT ${VISITOR_EXPR}) FILTER (WHERE ${VISITOR_EXPR} IN (SELECT visitor_key FROM visitor_tags WHERE is_excluded))::int AS excluded_visitors`

const KPI_SQL = (scope: Scope) => `
WITH sessions AS (${SESSION_METRICS_SQL(scope)})
SELECT ${KPI_SELECT(scope)},
  (SELECT count(*) FILTER (WHERE pv_count = 1)::int FROM sessions) AS bounced,
  (SELECT count(*) FILTER (WHERE pv_count > 0)::int FROM sessions) AS pv_sessions,
  (SELECT COALESCE(sum(duration), 0)::float FROM sessions) AS duration_sum
FROM track_events
WHERE app_name = $1 AND track_time >= $2 AND track_time < $3`

const SERIES_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)}), buckets AS (${bucketsSql})
SELECT b.bucket,
  count(s.id) FILTER (WHERE s.track_type = 'PageView')::int AS pv,
  count(DISTINCT s.visitor) FILTER (WHERE s.track_type = 'PageView')::int AS uv,
  count(s.id) FILTER (WHERE s.track_type = 'Error')::int AS errors
FROM buckets b LEFT JOIN scoped s ON ${bucketExpr.replace('track_time', 's.track_time')} = b.bucket
GROUP BY b.bucket ORDER BY b.bucket`

export const toKpi = (row: KpiRow): StatsKpi => ({
  pv: row.pv,
  uv: row.uv,
  sessions: row.sessions,
  users: row.users,
  errors: row.errors,
  errorRate: row.pv > 0 ? row.errors / row.pv : 0,
  botPv: row.bot_pv,
  totalPv: row.total_pv,
  bounceRate: row.pv_sessions > 0 ? row.bounced / row.pv_sessions : 0,
  avgVisitDuration: row.sessions > 0 ? Number(row.duration_sum) / row.sessions : 0,
  excludedVisitors: row.excluded_visitors
})

const queryKpi = async (pool: Pool, scope: Scope): Promise<StatsKpi> => {
  const { rows } = await pool.query<KpiRow>(KPI_SQL(scope), scopeParams(scope))
  return toKpi(rows[0])
}

export const queryOverview = async (pool: Pool, scope: Scope): Promise<OverviewStats> => {
  const [current, previous, series] = await Promise.all([
    queryKpi(pool, scope),
    queryKpi(pool, previousScope(scope)),
    pool.query<{ bucket: Date, pv: number, uv: number, errors: number }>(SERIES_SQL(scope), [...scopeParams(scope), scope.granularity, scope.timezone])
  ])
  return {
    granularity: scope.granularity,
    current,
    previous,
    series: series.rows.map((row) => ({ bucket: row.bucket.toISOString(), pv: row.pv, uv: row.uv, errors: row.errors }))
  }
}
