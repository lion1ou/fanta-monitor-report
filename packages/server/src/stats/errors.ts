import type { Pool } from 'pg'
import type { ErrorGroup, ErrorOccurrence, ErrorsStats } from '@fanta/shared'
import { bucketExpr, bucketsSql, scopeParams, scopedSql, type Scope } from './scope.js'

// 分组键：kind + 截断到 200 字符的 message
const KIND_EXPR = "COALESCE(track_data ->> 'kind', '')"
const MESSAGE_EXPR = "left(COALESCE(track_data ->> 'message', ''), 200)"

const TOTALS_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)})
SELECT
  count(*) FILTER (WHERE track_type = 'Error')::int AS total,
  count(DISTINCT visitor) FILTER (WHERE track_type = 'Error')::int AS affected,
  count(*) FILTER (WHERE track_type = 'PageView')::int AS pv
FROM scoped`

const SERIES_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)}), buckets AS (${bucketsSql})
SELECT b.bucket, count(s.id) FILTER (WHERE s.track_type = 'Error')::int AS errors
FROM buckets b LEFT JOIN scoped s ON ${bucketExpr.replace('track_time', 's.track_time')} = b.bucket
GROUP BY b.bucket ORDER BY b.bucket`

const GROUPS_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)})
SELECT kind, message, count(*)::int AS count, count(DISTINCT visitor)::int AS users,
  min(track_time) AS first_seen, max(track_time) AS last_seen,
  (array_agg(page_path ORDER BY track_time DESC))[1] AS last_path
FROM (SELECT visitor, track_time, page_path, ${KIND_EXPR} AS kind, ${MESSAGE_EXPR} AS message FROM scoped WHERE track_type = 'Error') e
GROUP BY kind, message ORDER BY count DESC, last_seen DESC LIMIT $4`

const OCCURRENCES_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)})
SELECT track_id, track_time, page_path, browser, browser_version, os, os_version, COALESCE(user_id, '') AS user_id, visitor, track_data
FROM scoped WHERE track_type = 'Error' AND ${KIND_EXPR} = $4 AND ${MESSAGE_EXPR} = $5
ORDER BY track_time DESC LIMIT $6`

interface GroupRow { kind: string, message: string, count: number, users: number, first_seen: Date, last_seen: Date, last_path: string }
interface OccurrenceRow {
  track_id: string
  track_time: Date
  page_path: string
  browser: string
  browser_version: string
  os: string
  os_version: string
  user_id: string
  visitor: string
  track_data: Record<string, unknown>
}

export const queryErrors = async (pool: Pool, scope: Scope, limit: number): Promise<ErrorsStats> => {
  const params = scopeParams(scope)
  const [totals, series, groups] = await Promise.all([
    pool.query<{ total: number, affected: number, pv: number }>(TOTALS_SQL(scope), params),
    pool.query<{ bucket: Date, errors: number }>(SERIES_SQL(scope), [...params, scope.granularity, scope.timezone]),
    pool.query<GroupRow>(GROUPS_SQL(scope), [...params, limit])
  ])
  const t = totals.rows[0]
  return {
    granularity: scope.granularity,
    total: t.total,
    affectedUsers: t.affected,
    errorRate: t.pv > 0 ? t.total / t.pv : 0,
    series: series.rows.map((row) => ({ bucket: row.bucket.toISOString(), errors: row.errors })),
    groups: groups.rows.map((row): ErrorGroup => ({
      kind: row.kind,
      message: row.message,
      count: row.count,
      users: row.users,
      firstSeen: row.first_seen.toISOString(),
      lastSeen: row.last_seen.toISOString(),
      lastPath: row.last_path
    }))
  }
}

export const queryErrorOccurrences = async (pool: Pool, scope: Scope, kind: string, message: string, limit: number): Promise<ErrorOccurrence[]> => {
  const { rows } = await pool.query<OccurrenceRow>(OCCURRENCES_SQL(scope), [...scopeParams(scope), kind, message.slice(0, 200), limit])
  return rows.map((row) => ({
    trackId: row.track_id,
    trackTime: row.track_time.toISOString(),
    path: row.page_path,
    browser: row.browser,
    browserVersion: row.browser_version,
    os: row.os,
    osVersion: row.os_version,
    userId: row.user_id,
    visitor: row.visitor,
    trackData: row.track_data
  }))
}
