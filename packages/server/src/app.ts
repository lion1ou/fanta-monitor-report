import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type { Pool } from 'pg'
import type { ServerConfig } from './config.js'
import { EMPTY_GEO, type GeoResolver } from './geo.js'
import { trackRoutes } from './routes/track.js'
import { statsRoutes } from './routes/stats.js'
import { adminRoutes } from './routes/admin.js'
import { sdkRoutes } from './routes/sdk.js'

// resolveGeo 为 null 表示 IP 地域库未加载：采集照常，地域三列留空
export const buildApp = (config: ServerConfig, pool: Pool, resolveGeo: GeoResolver | null): FastifyInstance => {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
    bodyLimit: 256 * 1024
  })

  // SDK 以 text/plain 发送 JSON 以避开 CORS 预检，这里按 JSON 解析
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, JSON.parse(String(body)))
    } catch (error) {
      const parseError = error instanceof Error ? error : new Error(String(error))
      done(Object.assign(parseError, { statusCode: 400 }), undefined)
    }
  })

  if (!resolveGeo) app.log.warn(`未找到 IP 地域库（${config.geoXdbDir}），地域解析已禁用；执行 npm run geo:download 下载`)
  void app.register(cors, { origin: config.corsOrigin })
  void app.register(trackRoutes, { pool, allowedApps: config.allowedApps, resolveGeo: resolveGeo ?? (async () => EMPTY_GEO) })
  void app.register(sdkRoutes, { distDir: config.sdkDist })
  if (config.adminToken) {
    void app.register(statsRoutes, { pool, allowedApps: config.allowedApps, adminToken: config.adminToken, timezone: config.statsTimezone })
    void app.register(adminRoutes, { distDir: config.adminDist })
  } else {
    app.log.warn('未配置 ADMIN_TOKEN，统计接口与管理后台未启用')
  }
  return app
}
