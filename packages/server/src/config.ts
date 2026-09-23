import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ServerConfig {
  databaseUrl: string
  port: number
  allowedApps: Set<string>
  corsOrigin: string
  trustProxy: boolean
  logLevel: string
  adminToken?: string // 未配置时不注册后台与统计接口
  statsTimezone: string // 统计分桶使用的时区，IANA 名称
  adminDist?: string // 后台静态产物目录，默认 packages/admin/dist
  sdkDist?: string // SDK 构建产物目录，默认 packages/sdk/dist
  geoXdbDir: string // ip2region xdb 数据目录，默认 packages/server/data/geo
}

// src/config.ts 与 dist/config.js 都位于包根下一级，../data/geo 指向同一目录
export const defaultGeoXdbDir = (): string => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/geo')

// 从环境变量装配配置；必填项缺失直接抛出，进程启动失败
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  const databaseUrl = env.DATABASE_URL
  const allowedAppsRaw = env.ALLOWED_APPS
  const missing = [!databaseUrl && 'DATABASE_URL', !allowedAppsRaw && 'ALLOWED_APPS'].filter(Boolean)
  if (!databaseUrl || !allowedAppsRaw) throw new Error(`缺少环境变量: ${missing.join(', ')}`)

  const allowedApps = allowedAppsRaw.split(',').map((name) => name.trim()).filter(Boolean)
  if (allowedApps.length === 0) throw new Error('ALLOWED_APPS 不能为空')

  return {
    databaseUrl,
    port: Number(env.PORT ?? 5001),
    allowedApps: new Set(allowedApps),
    corsOrigin: env.CORS_ORIGIN ?? '*',
    trustProxy: env.TRUST_PROXY === 'true',
    logLevel: env.LOG_LEVEL ?? 'info',
    adminToken: env.ADMIN_TOKEN ? env.ADMIN_TOKEN : undefined,
    statsTimezone: env.STATS_TIMEZONE ?? 'UTC',
    adminDist: env.ADMIN_DIST ? env.ADMIN_DIST : undefined,
    sdkDist: env.SDK_DIST ? env.SDK_DIST : undefined,
    geoXdbDir: env.GEO_XDB_DIR ? env.GEO_XDB_DIR : defaultGeoXdbDir()
  }
}
