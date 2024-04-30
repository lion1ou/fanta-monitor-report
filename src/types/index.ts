import { type TrackType } from './enum'

interface InitParams {
  [Z: string]: any
  reportHost?: string // 上报地址
  ipQueryHost?: string // ip查询地址
  appName: string
  appVersion?: string
  debug?: boolean
  userId?: string
}

interface IBaseInfo {
  userAgent: string // 浏览器信息
  deviceType: string // 设备类型
  mobileBrand: string // 手机品牌
  mobileModel: string // 手机型号
  os: string // 操作系统
  osVersion: string // 操作系统版本
  browser: string // 浏览器名称
  browserVersion: string // 浏览器版本
  browserEngine: string // 浏览器引擎
  isBot: boolean // 是否机器人
  isWebview: boolean // 是否webview
  language: string // 当前语言
  orientation: string // 屏幕方向
  screenWidth: number // 屏幕宽度
  screenHeight: number // 屏幕高度
  viewportWidth: number // 可视区域宽度
  viewportHeight: number // 可视区域高度
  pagePath: string // 页面路径无域名
  pageOrigin: string // 页面路径无参数
  pageSearch: string // 页面参数
  pageProtocol: string // 页面协议
}

interface IGetOs {
  os: string
  osVersion: string
}

interface IBrowser {
  browser: string
  browserVersion: string
  isBot: boolean
  isWebview: boolean
}
interface ITrackEvent {
  trackType: TrackType
  trackData: any
  trackTime: number
  trackId: string
}

export type {
  InitParams,
  IBaseInfo,
  IGetOs,
  IBrowser,
  ITrackEvent
}
