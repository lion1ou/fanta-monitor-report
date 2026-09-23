import type { GeoRegion, TrackEvent } from '@fanta/shared'
import { EMPTY_GEO, type GeoResolver } from '../src/geo.js'

// 集成测试不依赖真实 xdb：固定几个公网 IP 的地域，其余为未知
export const STUB_GEO: Record<string, GeoRegion> = {
  '120.24.78.68': { country: '中国', province: '广东省', city: '深圳市' },
  '39.156.66.10': { country: '中国', province: '北京市', city: '北京市' },
  '8.8.8.8': { country: 'United States', province: 'California', city: '' },
  '127.0.0.1': { country: '内网', province: '', city: '' }
}

export const stubGeoResolver: GeoResolver = async (ip) => STUB_GEO[ip] ?? EMPTY_GEO

export const makeEvent = (overrides: Partial<TrackEvent> = {}): TrackEvent => ({
  trackId: 'evt-1',
  trackType: 'PageView',
  trackTime: 1_700_000_000_000,
  trackData: { page: 'home' },
  appName: 'demo',
  uuid: 'uuid-1',
  sessionId: 'sess-1',
  sdkVersion: '0.1.0',
  sdkEnv: 'test',
  pageOrigin: 'http://localhost',
  pagePath: '/',
  pageSearch: '',
  pageProtocol: 'http:',
  pageTitle: 'Home',
  referrer: '',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  deviceType: 'Desktop',
  mobileBrand: '',
  mobileModel: '',
  os: 'Mac OS X',
  osVersion: '14',
  browser: 'Chrome',
  browserVersion: '120',
  browserEngine: 'Blink',
  isBot: false,
  isWebview: false,
  language: 'zh-CN',
  orientation: 'landscape',
  screenWidth: 1920,
  screenHeight: 1080,
  viewportWidth: 1200,
  viewportHeight: 800,
  networkType: 'wifi',
  networkEffectiveType: '4g',
  fingerPrint: 'fp',
  fingerPrintCanvas: 'fpc',
  ...overrides
})
