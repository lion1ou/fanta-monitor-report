import { Pool } from 'pg'
import { parseUtm } from '../src/db.js'

// 为 UTM 三列为空但 page_search 含 utm_ 的历史行回填：按 distinct page_search 解析一次，再批量 UPDATE
if (!process.env.DATABASE_URL) {
  console.error('缺少环境变量 DATABASE_URL')
  process.exit(1)
}

const PENDING = "utm_source = '' AND utm_medium = '' AND utm_campaign = '' AND page_search LIKE '%utm\\_%'"
const BATCH = 2000

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const { rows } = await pool.query<{ page_search: string }>(`SELECT DISTINCT page_search FROM track_events WHERE ${PENDING}`)
  const parsed = rows.map(({ page_search }) => ({ search: page_search, ...parseUtm(page_search) })).filter((utm) => utm.utmSource || utm.utmMedium || utm.utmCampaign)
  console.log(`待回填 search ${rows.length} 种，可解析 ${parsed.length} 种`)
  let updated = 0
  for (let index = 0; index < parsed.length; index += BATCH) {
    const { rowCount } = await pool.query(
      `UPDATE track_events t SET utm_source = u.source, utm_medium = u.medium, utm_campaign = u.campaign
       FROM jsonb_to_recordset($1::jsonb) AS u(search text, source text, medium text, campaign text)
       WHERE t.page_search = u.search AND ${PENDING}`,
      [JSON.stringify(parsed.slice(index, index + BATCH).map((u) => ({ search: u.search, source: u.utmSource, medium: u.utmMedium, campaign: u.utmCampaign })))]
    )
    updated += rowCount ?? 0
  }
  console.log(`更新 ${updated} 行`)
} finally {
  await pool.end()
}
