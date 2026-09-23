import type { TrackEvent } from '@fanta/shared'

export interface AutoTrackOptions {
  pageView: boolean
  error: boolean
  performance: boolean
}

export interface InitParams {
  reportHost: string
  appName: string
  appVersion?: string
  userId?: string
  debug?: boolean
  enableGeo?: boolean
  autoTrack?: Partial<AutoTrackOptions>
  batchSize?: number
  flushInterval?: number
  enableImgFallback?: boolean
}

// 填充默认值后的配置
export interface SdkConfig {
  reportHost: string
  appName: string
  appVersion: string
  userId: string
  debug: boolean
  enableGeo: boolean
  autoTrack: AutoTrackOptions
  batchSize: number
  flushInterval: number
  enableImgFallback: boolean
}

// 页面信息，每次上报时实时读取
export type PageInfo = Pick<TrackEvent, 'pageOrigin' | 'pagePath' | 'pageSearch' | 'pageProtocol' | 'pageTitle' | 'referrer'>

// 设备与浏览器信息，初始化时读取一次
export type DeviceInfo = Pick<TrackEvent,
'userAgent' | 'deviceType' | 'mobileBrand' | 'mobileModel' | 'os' | 'osVersion' |
'browser' | 'browserVersion' | 'browserEngine' | 'isBot' | 'isWebview' | 'isWebdriver' | 'language' | 'orientation' |
'screenWidth' | 'screenHeight' | 'viewportWidth' | 'viewportHeight'>

// 事件公共上下文：TrackEvent 去掉事件体、会话与页面字段
export type EventContext = Omit<TrackEvent, 'trackId' | 'trackType' | 'trackTime' | 'trackData' | 'sessionId' | keyof PageInfo>

export type TrackData = Record<string, unknown>

export interface IGetOs {
  os: string
  osVersion: string
}

export interface IBrowser {
  browser: string
  browserVersion: string
  isBot: boolean
  isWebview: boolean
  isWebdriver: boolean
}
