import type { EventContext, InitParams, SdkConfig } from '../types'
import { getBaseInfo, getGeoInfo, getNetwork, getFingerPrint } from '../h5/h5BaseInfo'
import { resolveVisitorId } from './visitorId'
import log from './log'

const DEFAULT_CONFIG: SdkConfig = {
  reportHost: '',
  appName: '',
  appVersion: '',
  userId: '',
  debug: false,
  enableGeo: false,
  autoTrack: { pageView: true, error: true, performance: true },
  batchSize: 10,
  flushInterval: 5000,
  enableImgFallback: true
}

const EMPTY_CONTEXT: EventContext = {
  appName: '',
  appVersion: '',
  userId: '',
  uuid: '',
  sdkVersion: '',
  sdkEnv: '',
  userAgent: '',
  deviceType: '',
  mobileBrand: '',
  mobileModel: '',
  os: '',
  osVersion: '',
  browser: '',
  browserVersion: '',
  browserEngine: '',
  isBot: false,
  isWebview: false,
  isWebdriver: false,
  language: '',
  orientation: '',
  screenWidth: 0,
  screenHeight: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  networkType: '',
  networkEffectiveType: '',
  fingerPrint: '',
  fingerPrintCanvas: ''
}

const Store = {
  config: DEFAULT_CONFIG,
  context: EMPTY_CONTEXT,

  // 合并配置、同步采集设备信息与指纹；网络、坐标异步补充
  init (params: InitParams, sdk: { version: string, env: string }) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...params,
      appVersion: params.appVersion ?? '',
      userId: params.userId ?? '',
      autoTrack: { ...DEFAULT_CONFIG.autoTrack, ...params.autoTrack }
    }
    this.context = {
      ...EMPTY_CONTEXT,
      ...getBaseInfo(),
      ...getFingerPrint(),
      appName: this.config.appName,
      appVersion: this.config.appVersion,
      userId: this.config.userId,
      uuid: resolveVisitorId(this.config.cookieDomain),
      sdkVersion: sdk.version,
      sdkEnv: sdk.env
    }
    getNetwork().then((network) => { this.context = { ...this.context, ...network } }, (error) => { log.error('get network error', error); })
    if (this.config.enableGeo) {
      getGeoInfo().then((coordinates) => { this.context = { ...this.context, coordinates } }, (error) => { log.error('get geo info error', error); })
    }
  },

  getContext (): EventContext {
    return this.context
  },

  setUserId (userId: string) {
    this.config = { ...this.config, userId }
    this.context = { ...this.context, userId }
  },

  getDebug (): boolean {
    return this.config.debug
  }
}

export default Store
