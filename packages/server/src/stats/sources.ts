import type { Pool } from 'pg'
import type { Distribution, SourcesStats } from '@fanta/shared'
import { REFERRER_HOST_EXPR, scopeParams, scopedSql, type Scope } from './scope.js'

// 每个会话最早的 PageView 决定来源；与页面自身同域的 referrer 视为站内跳转，归入直接访问
const REFERRERS_SQL = (scope: Scope) => `
WITH scoped AS (${scopedSql(scope)}),
first_pv AS (SELECT DISTINCT ON (session_id) referrer, page_origin FROM scoped WHERE track_type = 'PageView' ORDER BY session_id, track_time)
SELECT COALESCE(NULLIF(${REFERRER_HOST_EXPR}, ''), '(direct)') AS host, count(*)::int AS sessions
FROM first_pv
WHERE referrer = '' OR referrer IS NULL OR NOT starts_with(referrer, page_origin)
GROUP BY host ORDER BY sessions DESC, host LIMIT $5`

const UTM_COLUMNS = { utmSource: 'utm_source', utmMedium: 'utm_medium', utmCampaign: 'utm_campaign' } as const

const UTM_SQL = (scope: Scope, column: string) => `
WITH scoped AS (${scopedSql(scope)})
SELECT ${column} AS name, count(DISTINCT visitor)::int AS uv, count(*)::int AS pv
FROM scoped WHERE track_type = 'PageView' AND ${column} <> ''
GROUP BY name ORDER BY uv DESC, pv DESC, name LIMIT $5`

export const querySources = async (pool: Pool, scope: Scope, limit: number): Promise<SourcesStats> => {
  const params = [...scopeParams(scope), limit]
  const [referrers, utmSource, utmMedium, utmCampaign] = await Promise.all([
    pool.query<SourcesStats['referrers'][number]>(REFERRERS_SQL(scope), params),
    ...Object.values(UTM_COLUMNS).map(async (column) => await pool.query<Distribution>(UTM_SQL(scope, column), params))
  ])
  return { referrers: referrers.rows, utmSource: utmSource.rows, utmMedium: utmMedium.rows, utmCampaign: utmCampaign.rows }
}
