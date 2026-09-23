import { loadConfig } from './config.js'
import { createPool } from './db.js'
import { buildApp } from './app.js'
import { loadGeoResolver } from './geo.js'
import { migrateUp } from './migrations.js'

const config = loadConfig()
const pool = createPool(config.databaseUrl)
// 地域查询告警走应用日志；闭包只在请求阶段执行，此时 app 已初始化
const app = buildApp(config, pool, loadGeoResolver(config.geoXdbDir, (message) => { app.log.warn(message) }))

// 先停止接收请求，再释放数据库连接
const shutdown = (signal: string) => {
  app.log.info({ signal }, '收到退出信号，开始关闭')
  app.close()
    .then(async () => { await pool.end(); })
    .then(() => process.exit(0), (error) => {
      app.log.error({ err: error }, '关闭失败')
      process.exit(1)
    })
}
process.on('SIGTERM', () => { shutdown('SIGTERM'); })
process.on('SIGINT', () => { shutdown('SIGINT'); })

// 启动时自动应用未执行的迁移，部署无需单独跑 migrate
const applied = await migrateUp(pool)
if (applied.length > 0) app.log.info({ applied }, '已应用数据库迁移')

await app.listen({ port: config.port, host: '0.0.0.0' })
