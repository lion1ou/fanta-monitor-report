import type { Pool } from 'pg'
import type { OverviewStats, StatsKpi } from '@fanta/shared'
import { VISITOR_EXPR, bucketExpr, bucketsSql, previousScope, scopeParams, scopedSql, type Scope } from './scope.js'

interface KpiRow {
  pv: number
  uv: number
  sessions: number
  users: number
  errors: number
  bot_pv: number
  total_pv: number
}

// KPI 在全量区间上算，爬虫过滤放进 FILTER，使 botPv / totalPv 不受 bots 参数影响
const KPI_SQL = (scope: Scope) => `
SELECT
  count(*) FILTER (WHERE track_type = 'PageView' AND ${scope.botsCondition})::int AS pv,
  count(DISTINCT ${VISITOR_EXPR}) FILTER (WHERE track_type = 'PageView' AND ${scope.botsCondition})::int AS uv,
  count(DISTINCT session_id) FILTER (WHERE ${scope.botsCondition})::int AS sessions,
  count(DISTINCT user_id) FILTER (WHERE user_id <> '' AND ${scope.botsCondition})::int AS users,
  count(*) FILTER (WHERE track_type = 'Error' AND ${scope.botsCondition})::int AS errors,
  count(*) FILTER (WHERE track_type = 'PageView' AND bot_verdict <> 'none')::int AS bot_pv,
  count(*) FILTER (WHERE track_type = 'PageView')::int AS total_pv
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

const toKpi = (row: KpiRow): StatsKpi => ({
  pv: row.pv,
  uv: row.uv,
  sessions: row.sessions,
  users: row.users,
  errors: row.errors,
  errorRate: row.pv > 0 ? row.errors / row.pv : 0,
  botPv: row.bot_pv,
  totalPv: row.total_pv
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
