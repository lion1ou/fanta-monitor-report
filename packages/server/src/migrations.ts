import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'

const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url))

const ensureVersionTable = async (pool: Pool) => {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
}

const appliedVersions = async (pool: Pool): Promise<string[]> => {
  const { rows } = await pool.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')
  return rows.map((row) => row.version)
}

// 迁移 SQL 与版本记录在同一事务内执行，失败整体回滚
const runInTransaction = async (pool: Pool, sql: string, bookkeeping: string, version: string) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query(bookkeeping, [version])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// 按文件名顺序应用全部未执行的 *.up.sql，返回本次应用的版本
export const migrateUp = async (pool: Pool): Promise<string[]> => {
  await ensureVersionTable(pool)
  const applied = new Set(await appliedVersions(pool))
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.up.sql')).sort()
  const done: string[] = []
  for (const file of files) {
    const version = file.replace(/\.up\.sql$/, '')
    if (applied.has(version)) continue
    const sql = await readFile(`${MIGRATIONS_DIR}${file}`, 'utf8')
    await runInTransaction(pool, sql, 'INSERT INTO schema_migrations (version) VALUES ($1)', version)
    done.push(version)
  }
  return done
}

// 回滚最近一个版本，返回该版本；无可回滚项返回 null
export const migrateDown = async (pool: Pool): Promise<string | null> => {
  await ensureVersionTable(pool)
  const versions = await appliedVersions(pool)
  const version = versions[versions.length - 1]
  if (!version) return null
  const sql = await readFile(`${MIGRATIONS_DIR}${version}.down.sql`, 'utf8')
  await runInTransaction(pool, sql, 'DELETE FROM schema_migrations WHERE version = $1', version)
  return version
}
