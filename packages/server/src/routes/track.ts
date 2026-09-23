import type { FastifyPluginAsync } from 'fastify'
import type { Pool } from 'pg'
import { Ajv } from 'ajv'
import { trackBatchSchema, trackEventSchema, type TrackBatch, type TrackEvent } from '@fanta/shared'
import { insertTrackEvents } from '../db.js'
import type { GeoResolver } from '../geo.js'

const GIF_1X1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const validateEvent = new Ajv({ removeAdditional: true, coerceTypes: true }).compile<TrackEvent>(trackEventSchema)

// 像素上报把单条事件 JSON 以 base64url 放在 query d 中
const decodePixelEvent = (encoded: string): TrackEvent => {
  const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  if (!validateEvent(parsed)) throw new Error(`事件不符合契约: ${JSON.stringify(validateEvent.errors)}`)
  return parsed
}

export interface TrackRoutesOptions {
  pool: Pool
  allowedApps: Set<string>
  resolveGeo: GeoResolver
}

export const trackRoutes: FastifyPluginAsync<TrackRoutesOptions> = async (app, { pool, allowedApps, resolveGeo }) => {
  app.post<{ Body: TrackBatch }>('/v1/track', { schema: { body: trackBatchSchema } }, async (request, reply) => {
    const { events } = request.body
    const rejected = events.find((event) => !allowedApps.has(event.appName))
    if (rejected) return await reply.code(403).send({ error: 'app_not_allowed', appName: rejected.appName })
    const accepted = await insertTrackEvents(pool, events, request.ip, await resolveGeo(request.ip))
    return { accepted, duplicates: events.length - accepted }
  })

  app.get<{ Querystring: { d?: string } }>('/v1/track.gif', {
    schema: { querystring: { type: 'object', properties: { d: { type: 'string' } } } }
  }, async (request, reply) => {
    void reply.header('Cache-Control', 'no-store').type('image/gif')
    let event: TrackEvent
    try {
      event = decodePixelEvent(request.query.d ?? '')
    } catch (error) {
      request.log.warn({ err: error }, '像素上报数据无效')
      return await reply.send(GIF_1X1)
    }
    if (!allowedApps.has(event.appName)) {
      request.log.warn({ appName: event.appName }, '像素上报 appName 不在白名单')
      return await reply.send(GIF_1X1)
    }
    await insertTrackEvents(pool, [event], request.ip, await resolveGeo(request.ip))
    return await reply.send(GIF_1X1)
  })

  app.get('/health', async (request, reply) => {
    try {
      await pool.query('SELECT 1')
      return { status: 'ok' }
    } catch (error) {
      request.log.error({ err: error }, '数据库不可用')
      return await reply.code(503).send({ status: 'error' })
    }
  })
}
