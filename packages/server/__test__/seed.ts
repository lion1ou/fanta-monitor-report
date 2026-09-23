import type { Pool } from 'pg'
import type { TrackEvent } from '@fanta/shared'
import { insertTrackEvents } from '../src/db.js'
import { makeEvent, stubGeoResolver } from './helpers.js'

// 固定时间基准，所有统计测试的期望值都由这份种子推导
export const T0 = Date.parse('2026-09-20T00:00:00Z')
export const DAY = 24 * 60 * 60 * 1000
export const HOUR = 60 * 60 * 1000
const MIN = 60 * 1000

export const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
export const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const SAFARI_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const desktop: Partial<TrackEvent> = {
  deviceType: 'Desktop', os: 'Mac OS X', osVersion: '14', browser: 'Chrome', browserVersion: '120',
  screenWidth: 1920, screenHeight: 1080, networkEffectiveType: '4g', language: 'zh-CN', userAgent: CHROME_UA
}
const mobile: Partial<TrackEvent> = {
  deviceType: 'Mobile', os: 'iOS', osVersion: '17', browser: 'Safari', browserVersion: '17',
  screenWidth: 390, screenHeight: 844, networkEffectiveType: '4g', language: 'en-US', userAgent: SAFARI_IOS_UA
}

// 访客 A：登录桌面用户；B：移动端两次会话；E：无指纹桌面访客；C：Googlebot；D：webdriver
const A: Partial<TrackEvent> = { ...desktop, fingerPrint: 'fpA', uuid: 'uA', sessionId: 'sA', userId: 'u1' }
const B: Partial<TrackEvent> = { ...mobile, fingerPrint: 'fpB', uuid: 'uB', sessionId: 'sB' }
const B2: Partial<TrackEvent> = { ...B, sessionId: 'sB2' }
const E: Partial<TrackEvent> = { ...desktop, fingerPrint: '', uuid: 'uE', sessionId: 'sE' }
const C: Partial<TrackEvent> = { ...desktop, userAgent: GOOGLEBOT_UA, fingerPrint: '', uuid: 'uC', sessionId: 'sC' }
const D: Partial<TrackEvent> = { ...desktop, fingerPrint: 'fpD', uuid: 'uD', sessionId: 'sD', isWebdriver: true }

let seq = 0
const ev = (who: Partial<TrackEvent>, at: number, patch: Partial<TrackEvent>): TrackEvent =>
  makeEvent({ ...who, trackId: `seed-${++seq}`, trackTime: at, ...patch })

export const seedEvents = (): TrackEvent[] => {
  seq = 0
  return [
    ev(A, T0 + HOUR, { trackType: 'PageView', pagePath: '/', referrer: 'https://google.com/search?q=x', trackData: { trigger: 'init' } }),
    ev(C, T0 + HOUR, { trackType: 'PageView', pagePath: '/', trackData: {} }),
    ev(A, T0 + HOUR + 5 * MIN, { trackType: 'Performance', pagePath: '/', trackData: { lcp: 2000, fcp: 1000, cls: 0.05, inp: 150, fid: 50, ttfb: 300, load: 1500, domReady: 1000 } }),
    ev(A, T0 + HOUR + 10 * MIN, { trackType: 'Click', pagePath: '/', trackData: { button: 'buy' } }),
    ev(C, T0 + HOUR + 30 * MIN, { trackType: 'PageView', pagePath: '/pricing', trackData: {} }),
    ev(A, T0 + 2 * HOUR, { trackType: 'PageView', pagePath: '/pricing', referrer: 'https://google.com/search?q=x', trackData: { trigger: 'pushState' } }),
    ev(E, T0 + 2 * HOUR, { trackType: 'PageView', pagePath: '/about', referrer: '', trackData: {} }),
    ev(A, T0 + 2 * HOUR + 5 * MIN, { trackType: 'Error', pagePath: '/pricing', trackData: { kind: 'js', name: 'Error', message: 'boom', stack: 'Error: boom\n  at a.js:1' } }),
    ev(D, T0 + DAY, { trackType: 'PageView', pagePath: '/', trackData: {} }),
    ev(B, T0 + DAY + HOUR, { trackType: 'PageView', pagePath: '/', referrer: '', trackData: {} }),
    ev(B, T0 + DAY + HOUR + 5 * MIN, { trackType: 'Performance', pagePath: '/', trackData: { lcp: 3000, fcp: 2000, cls: 0.3, inp: 600 } }),
    ev(B, T0 + DAY + HOUR + 10 * MIN, { trackType: 'Error', pagePath: '/', trackData: { kind: 'js', name: 'Error', message: 'boom', stack: 'Error: boom\n  at b.js:1' } }),
    ev(B, T0 + DAY + HOUR + 15 * MIN, { trackType: 'Error', pagePath: '/', trackData: { kind: 'promise', name: 'Error', message: 'rejected', stack: '' } }),
    ev(B2, T0 + 2 * DAY + HOUR, { trackType: 'PageView', pagePath: '/pricing', pageSearch: '?utm_source=wechat&utm_medium=social', referrer: 'https://twitter.com/x/status/1', trackData: {} })
  ]
}

// 访客 → 客户端 IP：A 深圳、B 北京、E 美国、爬虫 C/D 走本机
export const SEED_IP: Record<string, string> = { uA: '120.24.78.68', uB: '39.156.66.10', uE: '8.8.8.8', uC: '127.0.0.1', uD: '127.0.0.1' }

export const seedDatabase = async (pool: Pool) => {
  await pool.query('TRUNCATE track_events, visitor_tags')
  const events = seedEvents()
  for (const ip of new Set(Object.values(SEED_IP))) {
    const batch = events.filter((event) => SEED_IP[event.uuid] === ip)
    await insertTrackEvents(pool, batch, ip, await stubGeoResolver(ip))
  }
}
