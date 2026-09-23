import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { Pool } from 'pg'
import type { TrackEvent } from '@fanta/shared'
import { buildApp } from '../src/app.js'
import { migrateUp } from '../src/migrations.js'
import { makeEvent, stubGeoResolver } from './helpers.js'

const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl) throw new Error('缺少 TEST_DATABASE_URL，服务端集成测试需要真实 PostgreSQL')

const pool = new Pool({ connectionString: databaseUrl })
const app = buildApp({ databaseUrl, port: 0, allowedApps: new Set(['demo']), corsOrigin: '*', trustProxy: true, logLevel: 'silent', statsTimezone: 'UTC', geoXdbDir: '/nonexistent' }, pool, stubGeoResolver)

const postBatch = async (events: unknown[], headers: Record<string, string> = {}) => await app.inject({
  method: 'POST',
  url: '/v1/track',
  headers: { 'content-type': 'text/plain;charset=UTF-8', ...headers },
  payload: JSON.stringify({ events })
})

const countRows = async () => Number((await pool.query('SELECT count(*) FROM track_events')).rows[0].count)

beforeAll(async () => {
  await migrateUp(pool)
  await app.ready()
})
beforeEach(async () => { await pool.query('TRUNCATE track_events') })
afterAll(async () => {
  await app.close()
  await pool.end()
})

describe('POST /v1/track', () => {
  it('写入整批事件并记录代理头中的客户端 IP', async () => {
    const res = await postBatch(
      [makeEvent({ trackId: 'a' }), makeEvent({ trackId: 'b', trackType: 'Click', trackData: { button: 'buy' } })],
      { 'x-forwarded-for': '203.0.113.9' }
    )
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ accepted: 2, duplicates: 0 })
    const { rows } = await pool.query(
      'SELECT track_id, track_type, host(client_ip) AS client_ip, track_data, app_name, sdk_version FROM track_events ORDER BY track_id'
    )
    expect(rows).toEqual([
      { track_id: 'a', track_type: 'PageView', client_ip: '203.0.113.9', track_data: { page: 'home' }, app_name: 'demo', sdk_version: '0.1.0' },
      { track_id: 'b', track_type: 'Click', client_ip: '203.0.113.9', track_data: { button: 'buy' }, app_name: 'demo', sdk_version: '0.1.0' }
    ])
  })

  it('按客户端 IP 解析地域写入三列；未命中留空', async () => {
    await postBatch([makeEvent({ trackId: 'cn' })], { 'x-forwarded-for': '120.24.78.68' })
    await postBatch([makeEvent({ trackId: 'us' })], { 'x-forwarded-for': '8.8.8.8' })
    await postBatch([makeEvent({ trackId: 'unknown' })], { 'x-forwarded-for': '198.51.100.7' })
    const { rows } = await pool.query('SELECT track_id, geo_country, geo_province, geo_city FROM track_events ORDER BY track_id')
    expect(rows).toEqual([
      { track_id: 'cn', geo_country: '中国', geo_province: '广东省', geo_city: '深圳市' },
      { track_id: 'unknown', geo_country: '', geo_province: '', geo_city: '' },
      { track_id: 'us', geo_country: 'United States', geo_province: 'California', geo_city: '' }
    ])
  })

  it('从 pageSearch 解析 UTM 三列写入；visitor_key 取 uuid、无 uuid 时取指纹', async () => {
    await postBatch([
      makeEvent({ trackId: 'utm', pageSearch: '?utm_source=wechat&utm_medium=social&utm_campaign=%E6%98%A5%E8%8A%82&x=1' }),
      makeEvent({ trackId: 'plain', pageSearch: '', uuid: '', fingerPrint: 'fp-only' })
    ])
    const { rows } = await pool.query('SELECT track_id, utm_source, utm_medium, utm_campaign, visitor_key FROM track_events ORDER BY track_id')
    expect(rows).toEqual([
      { track_id: 'plain', utm_source: '', utm_medium: '', utm_campaign: '', visitor_key: 'fp-only' },
      { track_id: 'utm', utm_source: 'wechat', utm_medium: 'social', utm_campaign: '春节', visitor_key: 'uuid-1' }
    ])
  })

  it('track_time 按客户端毫秒时间戳写入', async () => {
    await postBatch([makeEvent({ trackTime: 1_700_000_000_000 })])
    const { rows } = await pool.query('SELECT extract(epoch FROM track_time) * 1000 AS ms FROM track_events')
    expect(Number(rows[0].ms)).toBe(1_700_000_000_000)
  })

  it('重复 trackId 只写一行并计入 duplicates', async () => {
    await postBatch([makeEvent({ trackId: 'dup' })])
    const res = await postBatch([makeEvent({ trackId: 'dup' }), makeEvent({ trackId: 'new' })])
    expect(res.json()).toEqual({ accepted: 1, duplicates: 1 })
    expect(await countRows()).toBe(2)
  })

  it('请求体不符合契约返回 400', async () => {
    const res = await postBatch([{ trackId: 'x' }])
    expect(res.statusCode).toBe(400)
    expect(await countRows()).toBe(0)
  })

  it('空数组返回 400', async () => {
    expect((await postBatch([])).statusCode).toBe(400)
  })

  it('appName 不在白名单返回 403 且整批不写库', async () => {
    const res = await postBatch([makeEvent({ trackId: 'ok' }), makeEvent({ trackId: 'bad', appName: 'evil' })])
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: 'app_not_allowed', appName: 'evil' })
    expect(await countRows()).toBe(0)
  })

  it('写入时按 UA 与 webdriver 信号计算 bot_verdict', async () => {
    const googlebot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    await postBatch([
      makeEvent({ trackId: 'human' }),
      makeEvent({ trackId: 'crawler', userAgent: googlebot }),
      makeEvent({ trackId: 'headless', isWebdriver: true })
    ])
    const { rows } = await pool.query('SELECT track_id, bot_verdict, is_webdriver FROM track_events ORDER BY track_id')
    expect(rows).toEqual([
      { track_id: 'crawler', bot_verdict: 'ua', is_webdriver: false },
      { track_id: 'headless', bot_verdict: 'webdriver', is_webdriver: true },
      { track_id: 'human', bot_verdict: 'none', is_webdriver: false }
    ])
  })

  it('application/json 同样可以解析', async () => {
    const res = await postBatch([makeEvent()], { 'content-type': 'application/json' })
    expect(res.statusCode).toBe(200)
  })

  it('text/plain 但不是 JSON 时返回 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/track', headers: { 'content-type': 'text/plain' }, payload: 'not json' })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /v1/track.gif', () => {
  const encode = (event: TrackEvent) => Buffer.from(JSON.stringify(event)).toString('base64url')

  it('解析 d 参数写入事件并返回 GIF', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/track.gif?d=${encode(makeEvent({ trackId: 'px' }))}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/gif')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.rawPayload.subarray(0, 6).toString()).toBe('GIF89a')
    expect(await countRows()).toBe(1)
  })

  it('d 无法解析时仍返回 GIF 且不写库', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/track.gif?d=not-base64-json' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('image/gif')
    expect(await countRows()).toBe(0)
  })

  it('appName 不在白名单时返回 GIF 且不写库', async () => {
    const res = await app.inject({ method: 'GET', url: `/v1/track.gif?d=${encode(makeEvent({ appName: 'evil' }))}` })
    expect(res.statusCode).toBe(200)
    expect(await countRows()).toBe(0)
  })
})

describe('GET /health', () => {
  it('数据库可用时返回 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok' })
  })
})
