import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyPluginAsync } from 'fastify'

export interface SdkRoutesOptions {
  distDir?: string
}

export const defaultSdkDist = (): string => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../sdk/dist')

// 公开托管 SDK 构建产物到 /sdk/，接入方用 <script> 引入；短缓存让发版后 5 分钟内生效
export const sdkRoutes: FastifyPluginAsync<SdkRoutesOptions> = async (app, options) => {
  const root = options.distDir ?? defaultSdkDist()
  if (!existsSync(path.join(root, 'fanta-report.umd.js'))) {
    app.log.warn({ root }, '未找到 SDK 构建产物，/sdk 未启用；请先执行 npm run build -w packages/sdk')
    return
  }
  await app.register(fastifyStatic, { root, prefix: '/sdk/', index: false, maxAge: 5 * 60 * 1000 })
}
