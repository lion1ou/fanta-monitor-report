import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import type { FastifyPluginAsync } from 'fastify'

export interface AdminRoutesOptions {
  distDir?: string
}

// 默认使用 monorepo 内 packages/admin/dist；可通过 ADMIN_DIST 覆盖
export const defaultAdminDist = (): string => path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../admin/dist')

// 托管后台静态产物到 /admin/，非文件路径回退 index.html 让 hash 路由与深链接可用
export const adminRoutes: FastifyPluginAsync<AdminRoutesOptions> = async (app, options) => {
  const root = options.distDir ?? defaultAdminDist()
  if (!existsSync(path.join(root, 'index.html'))) {
    app.log.warn({ root }, '未找到后台构建产物，/admin 未启用；请先执行 npm run build -w packages/admin')
    return
  }
  await app.register(fastifyStatic, { root, prefix: '/admin/', index: ['index.html'], wildcard: true })
  app.get('/admin', async (_request, reply) => await reply.redirect('/admin/', 302))
  app.setNotFoundHandler(async (request, reply) => {
    if (request.method === 'GET' && request.url.startsWith('/admin/')) return await reply.sendFile('index.html')
    return await reply.code(404).send({ error: 'not_found' })
  })
}
