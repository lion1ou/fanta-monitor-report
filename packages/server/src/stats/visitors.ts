import type { Pool } from 'pg'
import type { VisitorDetail, VisitorSummary, VisitorsStats } from '@fanta/shared'
import { scopeParams, scopedSql, type Scope } from './scope.js'
import { queryEvents } from './events.js'
import { TAG_JOIN_COLUMNS, tagFromJoin } from './tags.js'

interface SummaryRow {
  visitor: string
  first_seen: Date
  last_seen: Date
  sessions: number
  pv: number
  user_ids: string[]
  geo_country: string
  geo_province: string
  geo_city: string
  browser: string
  os: string
  device_type: string
  tag_label: string | null
  tag_is_excluded: boolean | null
  tag_note: string | null
  tag_updated_at: Date | null
}

// 每个访客一行：聚合计数 + 最近一次事件的设备/地域；$5 为 limit，$6 为指定访客（NULL 表示全部）
const SUMMARY_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)}),
agg AS (
  SELECT visitor, min(track_time) AS first_seen, max(track_time) AS last_seen,
    count(DISTINCT session_id)::int AS sessions,
    count(*) FILTER (WHERE track_type = 'PageView')::int AS pv,
    array_remove(array_agg(DISTINCT NULLIF(user_id, '')), NULL) AS user_ids
  FROM scoped WHERE ($6::text IS NULL OR visitor = $6) GROUP BY visitor
),
latest AS (
  SELECT DISTINCT ON (visitor) visitor, geo_country, geo_province, geo_city, browser, os, device_type
  FROM scoped ORDER BY visitor, track_time DESC
)
SELECT a.*, l.geo_country, l.geo_province, l.geo_city, l.browser, l.os, l.device_type, ${TAG_JOIN_COLUMNS}
FROM agg a JOIN latest l USING (visitor) LEFT JOIN visitor_tags t ON t.visitor_key = a.visitor
ORDER BY a.last_seen DESC LIMIT $5`

const toSummary = (row: SummaryRow): VisitorSummary => ({
  visitorKey: row.visitor,
  tag: tagFromJoin(row, row.visitor),
  firstSeen: row.first_seen.toISOString(),
  lastSeen: row.last_seen.toISOString(),
  sessions: row.sessions,
  pv: row.pv,
  userIds: row.user_ids,
  geo: { country: row.geo_country, province: row.geo_province, city: row.geo_city },
  browser: row.browser,
  os: row.os,
  deviceType: row.device_type
})

export const queryVisitors = async (pool: Pool, scope: Scope, limit: number): Promise<VisitorsStats> => {
  const { rows } = await pool.query<SummaryRow>(SUMMARY_SQL(scope), [...scopeParams(scope), limit, null])
  return { visitors: rows.map(toSummary) }
}

// 画像：区间内汇总 + 全时段（不限 app、不限区间）的首次访问、会话数与出现过的 app
export const queryVisitorDetail = async (pool: Pool, scope: Scope, visitorKey: string, eventLimit: number): Promise<VisitorDetail | null> => {
  const [summary, lifetime, events] = await Promise.all([
    pool.query<SummaryRow>(SUMMARY_SQL(scope), [...scopeParams(scope), 1, visitorKey]),
    pool.query<{ first_seen: Date | null, sessions: number, apps: string[] }>(
      "SELECT min(track_time) AS first_seen, count(DISTINCT session_id)::int AS sessions, COALESCE(array_agg(DISTINCT app_name), '{}') AS apps FROM track_events WHERE visitor_key = $1",
      [visitorKey]
    ),
    queryEvents(pool, scope, { visitor: visitorKey, limit: eventLimit, offset: 0 })
  ])
  const row = summary.rows[0]
  const life = lifetime.rows[0]
  if (!row || life.first_seen === null) return null
  return {
    profile: { ...toSummary(row), lifetimeFirstSeen: life.first_seen.toISOString(), lifetimeSessions: life.sessions, apps: life.apps },
    events: events.items
  }
}
