import { Pool } from 'pg'
import { defaultGeoXdbDir } from '../src/config.js'
import { loadGeoResolver } from '../src/geo.js'

// 为地域三列为空的历史行回填：按 distinct client_ip 解析一次，再按 IP 批量 UPDATE
if (!process.env.DATABASE_URL) {
  console.error('缺少环境变量 DATABASE_URL')
  process.exit(1)
}
const resolveGeo = loadGeoResolver(process.env.GEO_XDB_DIR ?? defaultGeoXdbDir())
if (!resolveGeo) {
  console.error('未找到 ip2region xdb 数据，请先执行 npm run geo:download')
  process.exit(1)
}

const UNRESOLVED = "geo_country = '' AND geo_province = '' AND geo_city = ''"
const BATCH = 2000

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const { rows } = await pool.query<{ ip: string }>(
    `SELECT DISTINCT host(client_ip) AS ip FROM track_events WHERE client_ip IS NOT NULL AND ${UNRESOLVED}`
  )
  const resolved = (await Promise.all(rows.map(async ({ ip }) => ({ ip, ...await resolveGeo(ip) })))).filter((geo) => geo.country !== '')
  console.log(`待回填 IP ${rows.length} 个，解析命中 ${resolved.length} 个`)
  let updated = 0
  for (let index = 0; index < resolved.length; index += BATCH) {
    const { rowCount } = await pool.query(
      `UPDATE track_events t SET geo_country = g.country, geo_province = g.province, geo_city = g.city
       FROM jsonb_to_recordset($1::jsonb) AS g(ip text, country text, province text, city text)
       WHERE t.client_ip = g.ip::inet AND ${UNRESOLVED}`,
      [JSON.stringify(resolved.slice(index, index + BATCH))]
    )
    updated += rowCount ?? 0
  }
  console.log(`更新 ${updated} 行`)
} finally {
  await pool.end()
}
