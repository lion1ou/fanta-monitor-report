import type { Pool } from 'pg'
import type { PagesStats } from '@fanta/shared'
import { scopeParams, scopedSql, type Scope } from './scope.js'

const PATHS_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)})
SELECT page_path AS path, count(*)::int AS pv, count(DISTINCT visitor)::int AS uv
FROM scoped WHERE track_type = 'PageView'
GROUP BY page_path ORDER BY pv DESC, path LIMIT $5`

// 每个会话最早的 PageView 视为入口
const FIRST_PV_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)})
SELECT DISTINCT ON (session_id) page_path, referrer FROM scoped WHERE track_type = 'PageView' ORDER BY session_id, track_time`

const ENTRIES_SQL = (scope: Scope) => `
SELECT page_path AS path, count(*)::int AS sessions FROM (${FIRST_PV_SQL(scope)}) f
GROUP BY page_path ORDER BY sessions DESC, path LIMIT $5`

const REFERRERS_SQL = (scope: Scope) => `
SELECT COALESCE(NULLIF(substring(referrer from '^[a-z]+://([^/]+)'), ''), '(direct)') AS host, count(*)::int AS sessions
FROM (${FIRST_PV_SQL(scope)}) f
GROUP BY host ORDER BY sessions DESC, host LIMIT $5`

const HOSTS_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)})
SELECT COALESCE(NULLIF(page_origin, ''), '(unknown)') AS host, count(*)::int AS pv, count(DISTINCT visitor)::int AS uv
FROM scoped WHERE track_type = 'PageView'
GROUP BY host ORDER BY pv DESC, host LIMIT $5`

export const queryPages = async (pool: Pool, scope: Scope, limit: number): Promise<PagesStats> => {
  const params = [...scopeParams(scope), limit]
  const [paths, entries, referrers, hosts] = await Promise.all([
    pool.query<PagesStats['paths'][number]>(PATHS_SQL(scope), params),
    pool.query<PagesStats['entries'][number]>(ENTRIES_SQL(scope), params),
    pool.query<PagesStats['referrers'][number]>(REFERRERS_SQL(scope), params),
    pool.query<PagesStats['hosts'][number]>(HOSTS_SQL(scope), params)
  ])
  return { paths: paths.rows, entries: entries.rows, referrers: referrers.rows, hosts: hosts.rows }
}
