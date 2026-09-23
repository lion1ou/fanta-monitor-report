import type { Pool } from 'pg'
import type { GlobalStats, StatsKpi } from '@fanta/shared'
import { bucketExpr, bucketsSql, previousScope, scopeParams, scopedSql, type Scope } from './scope.js'
import { KPI_SELECT, toKpi, type KpiRow } from './overview.js'

// 跨项目查询：scope.app 不参与，$1 改为 app 白名单数组
const withApps = (sql: string) => sql.replaceAll('app_name = $1', 'app_name = ANY($1::text[])')

const KPI_BY_APP_SQL = (scope: Scope) => withApps(`
WITH sessions AS (
  SELECT app_name, session_id,
    count(*) FILTER (WHERE track_type = 'PageView')::int AS pv_count,
    extract(epoch FROM max(track_time) - min(track_time)) AS duration
  FROM track_events
  WHERE app_name = $1 AND track_time >= $2 AND track_time < $3 AND ${scope.filterCondition}
  GROUP BY app_name, session_id
),
kpi AS (
  SELECT app_name, ${KPI_SELECT(scope)}
  FROM track_events WHERE app_name = $1 AND track_time >= $2 AND track_time < $3 GROUP BY app_name
),
by_session AS (
  SELECT app_name, count(*) FILTER (WHERE pv_count = 1)::int AS bounced, count(*) FILTER (WHERE pv_count > 0)::int AS pv_sessions, COALESCE(sum(duration), 0)::float AS duration_sum
  FROM sessions GROUP BY app_name
)
SELECT k.*, COALESCE(s.bounced, 0) AS bounced, COALESCE(s.pv_sessions, 0) AS pv_sessions, COALESCE(s.duration_sum, 0) AS duration_sum
FROM kpi k LEFT JOIN by_session s USING (app_name) ORDER BY k.app_name`)

const SERIES_BY_APP_SQL = (scope: Scope) => withApps(`
WITH scoped AS (${scopedSql(scope)}), buckets AS (${bucketsSql}), apps AS (SELECT DISTINCT app_name FROM scoped)
SELECT a.app_name, b.bucket,
  count(s.id) FILTER (WHERE s.track_type = 'PageView')::int AS pv,
  count(DISTINCT s.visitor) FILTER (WHERE s.track_type = 'PageView')::int AS uv
FROM apps a CROSS JOIN buckets b
LEFT JOIN scoped s ON s.app_name = a.app_name AND ${bucketExpr.replace('track_time', 's.track_time')} = b.bucket
GROUP BY a.app_name, b.bucket ORDER BY a.app_name, b.bucket`)

type AppKpiRow = KpiRow & { app_name: string }
interface SeriesRow { app_name: string, bucket: Date, pv: number, uv: number }

const paramsFor = (scope: Scope, apps: string[]) => {
  const [, from, to, dimensions] = scopeParams(scope)
  return [apps, from, to, dimensions]
}

export const queryGlobal = async (pool: Pool, scope: Scope, apps: string[]): Promise<GlobalStats> => {
  const [current, previous, series] = await Promise.all([
    pool.query<AppKpiRow>(KPI_BY_APP_SQL(scope), paramsFor(scope, apps)),
    pool.query<AppKpiRow>(KPI_BY_APP_SQL(previousScope(scope)), paramsFor(previousScope(scope), apps)),
    pool.query<SeriesRow>(SERIES_BY_APP_SQL(scope), [...paramsFor(scope, apps), scope.granularity, scope.timezone])
  ])
  const previousByApp = new Map(previous.rows.map((row) => [row.app_name, toKpi(row)]))
  const emptyKpi: StatsKpi = toKpi({ pv: 0, uv: 0, sessions: 0, users: 0, errors: 0, bot_pv: 0, total_pv: 0, bounced: 0, pv_sessions: 0, duration_sum: 0, excluded_visitors: 0 })
  return {
    granularity: scope.granularity,
    apps: current.rows.map((row) => ({
      app: row.app_name,
      current: toKpi(row),
      previous: previousByApp.get(row.app_name) ?? emptyKpi,
      series: series.rows.filter((s) => s.app_name === row.app_name).map((s) => ({ bucket: s.bucket.toISOString(), pv: s.pv, uv: s.uv }))
    }))
  }
}
