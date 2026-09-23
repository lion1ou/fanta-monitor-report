import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import type { Pool } from 'pg'
import { StatsError, limitOf, resolveScope, statsQuerySchema, type Scope, type StatsQuery } from '../stats/scope.js'
import { queryOverview } from '../stats/overview.js'
import { queryPages } from '../stats/pages.js'
import { queryDevices } from '../stats/devices.js'
import { queryPerformance } from '../stats/performance.js'
import { queryErrorOccurrences, queryErrors } from '../stats/errors.js'
import { queryEvents } from '../stats/events.js'
import { queryGlobal } from '../stats/global.js'
import { querySources } from '../stats/sources.js'
import { queryVisitorDetail, queryVisitors } from '../stats/visitors.js'
import { deleteVisitorTag, upsertVisitorTag } from '../stats/tags.js'
import { TRACK_TYPES, type TrackType, type VisitorTag } from '@fanta/shared'

export interface StatsRoutesOptions {
  pool: Pool
  allowedApps: Set<string>
  adminToken: string
  timezone: string
}

export const statsRoutes: FastifyPluginAsync<StatsRoutesOptions> = async (app, { pool, allowedApps, adminToken, timezone }) => {
  // 插件内所有路由都要求 Bearer token
  app.addHook('onRequest', async (request, reply) => {
    if (request.headers.authorization !== `Bearer ${adminToken}`) {
      return await reply.code(401).send({ error: 'unauthorized' })
    }
  })

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof StatsError) return await reply.code(error.statusCode).send({ error: 'bad_request', message: error.message })
    throw error
  })

  // 校验 app 白名单并解析公共参数；不在白名单直接 403
  const scopeOf = async (request: FastifyRequest<{ Querystring: StatsQuery }>, reply: FastifyReply): Promise<Scope | null> => {
    if (!allowedApps.has(request.query.app)) {
      await reply.code(403).send({ error: 'app_not_allowed', appName: request.query.app })
      return null
    }
    return resolveScope(request.query, timezone)
  }

  app.get('/v1/stats/apps', async () => {
    const { rows } = await pool.query<{ app_name: string }>('SELECT DISTINCT app_name FROM track_events WHERE app_name = ANY($1::text[]) ORDER BY app_name', [[...allowedApps]])
    return { apps: rows.map((row) => row.app_name) }
  })

  // 跨项目总览：不接受 app 与维度过滤，按白名单内所有 app 分组
  app.get<{ Querystring: GlobalQuery }>('/v1/stats/global', { schema: { querystring: globalQuerySchema } }, async (request) => {
    const scope = resolveScope({ ...request.query, app: '*' }, timezone)
    return await queryGlobal(pool, scope, [...allowedApps])
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/sources', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await querySources(pool, scope, limitOf(request.query, 20, 50))
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/visitors', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await queryVisitors(pool, scope, limitOf(request.query, 50, 200))
  })

  app.get<{ Querystring: StatsQuery, Params: VisitorParams }>('/v1/stats/visitors/:key', { schema: { querystring: statsQuerySchema, params: visitorParamsSchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    const detail = await queryVisitorDetail(pool, scope, request.params.key, limitOf(request.query, 100, 200))
    if (!detail) return await reply.code(404).send({ error: 'visitor_not_found' })
    return detail
  })

  app.put<{ Params: VisitorParams, Body: TagBody }>('/v1/visitors/:key/tag', { schema: { params: visitorParamsSchema, body: tagBodySchema } }, async (request) => {
    return await upsertVisitorTag(pool, request.params.key, { note: '', ...request.body })
  })

  app.delete<{ Params: VisitorParams }>('/v1/visitors/:key/tag', { schema: { params: visitorParamsSchema } }, async (request, reply) => {
    const deleted = await deleteVisitorTag(pool, request.params.key)
    return await reply.code(deleted ? 204 : 404).send()
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/overview', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await queryOverview(pool, scope)
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/pages', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await queryPages(pool, scope, limitOf(request.query, 20, 50))
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/devices', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await queryDevices(pool, scope)
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/performance', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await queryPerformance(pool, scope)
  })

  app.get<{ Querystring: StatsQuery }>('/v1/stats/errors', { schema: { querystring: statsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    return await queryErrors(pool, scope, limitOf(request.query, 50, 100))
  })

  app.get<{ Querystring: OccurrencesQuery }>('/v1/stats/errors/occurrences', { schema: { querystring: occurrencesQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    const { kind, message } = request.query
    return { items: await queryErrorOccurrences(pool, scope, kind, message, limitOf(request.query, 20, 50)) }
  })

  app.get<{ Querystring: EventsQuery }>('/v1/stats/events', { schema: { querystring: eventsQuerySchema } }, async (request, reply) => {
    const scope = await scopeOf(request, reply)
    if (!scope) return
    const { type, q, path, offset } = request.query
    return await queryEvents(pool, scope, { type, q: nonEmpty(q), path: nonEmpty(path), limit: limitOf(request.query, 50, 100), offset: offset ?? 0 })
  })
}

// 空字符串视为未传
const nonEmpty = (value?: string): string | undefined => value === undefined || value === '' ? undefined : value

const occurrencesQuerySchema = {
  ...statsQuerySchema,
  required: [...statsQuerySchema.required, 'kind', 'message'],
  properties: { ...statsQuerySchema.properties, kind: { type: 'string' }, message: { type: 'string' } }
} as const

const eventsQuerySchema = {
  ...statsQuerySchema,
  properties: {
    ...statsQuerySchema.properties,
    type: { type: 'string', enum: TRACK_TYPES },
    q: { type: 'string', maxLength: 200 },
    path: { type: 'string', maxLength: 500 },
    offset: { type: 'integer', minimum: 0, maximum: 10000 }
  }
} as const

// 全局总览不带 app，也不带维度过滤
const { app: _app, ...globalProperties } = statsQuerySchema.properties
const globalQuerySchema = {
  type: 'object',
  required: ['from', 'to'],
  properties: { from: globalProperties.from, to: globalProperties.to, bots: globalProperties.bots, tagged: globalProperties.tagged }
} as const

const visitorParamsSchema = { type: 'object', required: ['key'], properties: { key: { type: 'string', minLength: 1, maxLength: 200 } } } as const

const tagBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'isExcluded'],
  properties: {
    label: { type: 'string', minLength: 1, maxLength: 50 },
    isExcluded: { type: 'boolean' },
    note: { type: 'string', maxLength: 500 }
  }
} as const

interface GlobalQuery extends Omit<StatsQuery, 'app'> {}
interface VisitorParams { key: string }
type TagBody = Pick<VisitorTag, 'label' | 'isExcluded'> & { note?: string }
interface OccurrencesQuery extends StatsQuery { kind: string, message: string }
interface EventsQuery extends StatsQuery { type?: TrackType, q?: string, path?: string, offset?: number }
