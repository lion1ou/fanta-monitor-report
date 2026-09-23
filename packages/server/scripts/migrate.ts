import { Pool } from 'pg'
import { migrateUp, migrateDown } from '../src/migrations.js'

const command = process.argv[2]
if (command !== 'up' && command !== 'down') {
  console.error('用法: migrate up|down')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('缺少环境变量 DATABASE_URL')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  if (command === 'up') {
    const applied = await migrateUp(pool)
    console.log(applied.length > 0 ? `已应用: ${applied.join(', ')}` : '没有待应用的迁移')
  } else {
    const reverted = await migrateDown(pool)
    console.log(reverted ? `已回滚: ${reverted}` : '没有可回滚的迁移')
  }
} finally {
  await pool.end()
}
