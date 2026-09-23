import type { Pool } from 'pg'
import type { BotVerdict, DevicesStats, Distribution } from '@fanta/shared'
import { VISITOR_EXPR, scopeParams, scopedSql, type Scope } from './scope.js'

// 分布维度的 SQL 表达式，均为固定字符串；地域省/市为空时回退到上一级名称（海外仅到国家、内网仅有国家）
const DIMENSIONS = {
  deviceType: 'device_type',
  os: 'os',
  browser: 'browser',
  screen: "screen_width || 'x' || screen_height",
  network: 'network_effective_type',
  language: 'language',
  geoCountry: 'geo_country',
  geoProvince: "COALESCE(NULLIF(geo_province, ''), geo_country)",
  geoCity: "COALESCE(NULLIF(geo_city, ''), NULLIF(geo_province, ''), geo_country)"
} as const

type Dimension = keyof typeof DIMENSIONS

const DISTRIBUTION_SQL = (scope: Scope, expr: string) => `
WITH scoped AS (${scopedSql(scope)})
SELECT COALESCE(NULLIF(${expr}, ''), '(unknown)') AS name, count(DISTINCT visitor)::int AS uv, count(*)::int AS pv
FROM scoped WHERE track_type = 'PageView'
GROUP BY name ORDER BY uv DESC, pv DESC, name LIMIT 10`

// 爬虫面板看全部流量，不受 bots 参数影响
const ALL_PV = "FROM track_events WHERE app_name = $1 AND track_time >= $2 AND track_time < $3 AND track_type = 'PageView'"

const BOT_TOTALS_SQL = `
SELECT
  count(DISTINCT ${VISITOR_EXPR}) FILTER (WHERE bot_verdict = 'none')::int AS real_uv,
  count(*) FILTER (WHERE bot_verdict = 'none')::int AS real_pv,
  count(DISTINCT ${VISITOR_EXPR}) FILTER (WHERE bot_verdict <> 'none')::int AS bot_uv,
  count(*) FILTER (WHERE bot_verdict <> 'none')::int AS bot_pv
${ALL_PV}`

const VERDICTS_SQL = `SELECT bot_verdict AS verdict, count(*)::int AS pv ${ALL_PV} AND bot_verdict <> 'none' GROUP BY verdict ORDER BY pv DESC, verdict`
const AGENTS_SQL = `SELECT user_agent AS name, count(*)::int AS pv ${ALL_PV} AND bot_verdict <> 'none' GROUP BY name ORDER BY pv DESC, name LIMIT 10`

export const queryDevices = async (pool: Pool, scope: Scope): Promise<DevicesStats> => {
  const params = scopeParams(scope)
  const dimensions = Object.keys(DIMENSIONS) as Dimension[]
  const [distributions, totals, verdicts, agents] = await Promise.all([
    Promise.all(dimensions.map(async (key) => await pool.query<Distribution>(DISTRIBUTION_SQL(scope, DIMENSIONS[key]), params))),
    pool.query<{ real_uv: number, real_pv: number, bot_uv: number, bot_pv: number }>(BOT_TOTALS_SQL, params),
    pool.query<{ verdict: BotVerdict, pv: number }>(VERDICTS_SQL, params),
    pool.query<{ name: string, pv: number }>(AGENTS_SQL, params)
  ])
  const { geoCountry, geoProvince, geoCity, ...byDimension } = Object.fromEntries(dimensions.map((key, index) => [key, distributions[index].rows])) as Record<Dimension, Distribution[]>
  const t = totals.rows[0]
  return {
    ...byDimension,
    geo: { country: geoCountry, province: geoProvince, city: geoCity },
    bots: { realUv: t.real_uv, realPv: t.real_pv, botUv: t.bot_uv, botPv: t.bot_pv, verdicts: verdicts.rows, agents: agents.rows }
  }
}
