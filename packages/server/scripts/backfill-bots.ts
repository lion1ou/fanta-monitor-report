import { Pool } from 'pg'
import { isbot } from 'isbot'

// 用服务端 UA 库重算历史数据：只处理尚未被任何信号判定为爬虫的行
if (!process.env.DATABASE_URL) {
  console.error('缺少环境变量 DATABASE_URL')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const { rows } = await pool.query<{ user_agent: string }>(
    "SELECT DISTINCT user_agent FROM track_events WHERE bot_verdict = 'none' AND is_webdriver = false AND user_agent <> ''"
  )
  const botAgents = rows.map((row) => row.user_agent).filter((ua) => isbot(ua))
  if (botAgents.length === 0) {
    console.log('没有需要回填的 UA')
  } else {
    const { rowCount } = await pool.query(
      "UPDATE track_events SET bot_verdict = 'ua' WHERE bot_verdict = 'none' AND user_agent = ANY($1::text[])",
      [botAgents]
    )
    console.log(`命中 ${botAgents.length} 个 UA，更新 ${rowCount ?? 0} 行`)
  }
} finally {
  await pool.end()
}
