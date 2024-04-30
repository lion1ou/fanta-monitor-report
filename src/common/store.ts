import { type IBaseInfo, type InitParams } from '../types'
import { getBaseInfo, generateUuid, getGeoInfo, getIpAddress, getNetwork } from '../h5/h5BaseInfo'

const initState: InitParams & IBaseInfo = {
  // 入参信息
  appName: '',
  appVersion: '',
  userId: '',
  debug: false,
  // SDK信息
  sdkVersion: '',
  sdkBuildTime: '',
  // 基础信息
  userAgent: '', // 浏览器信息
  deviceType: '', // 设备类型
  mobileBrand: '', // 手机品牌
  mobileModel: '', // 手机型号
  os: '', // 操作系统
  osVersion: '', // 操作系统版本
  browser: '', // 浏览器名称
  browserVersion: '', // 浏览器版本
  browserEngine: '', // 浏览器引擎
  isBot: false, // 是否机器人
  isWebview: false, // 是否webview
  language: '', // 当前语言
  orientation: '', // 屏幕方向
  screenWidth: 0, // 屏幕宽度
  screenHeight: 0, // 屏幕高度
  viewportWidth: 0, // 可视区域宽度
  viewportHeight: 0, // 可视区域高度
  coordinates: '', // 经纬度 逗号分隔 `经度(longitude),纬度(latitude)`
  networkType: '', // 网络类型
  networkEffectiveType: '', // 网络连接类型
  ip: '',
  uuid: '',
  pagePath: '',
  pageOrigin: '',
  pageSearch: '',
  pageProtocol: ''
}

const Store = {
  state: initState,
  initData () {
    this.setBaseInfoSync()
    this.setUUid()
    this.setGeoInfo()
    this.setIp()
    this.setNetwork()
  },
  getData (key?: string) {
    if (key) {
      return this.state?.[key]
    }
    return this.state
  },
  setParams (params?: InitParams) {
    if (params) {
      this.state = {
        ...this.state,
        ...params
      }
    }
  },
  setBaseInfoSync () {
    this.state = {
      ...this.state,
      ...getBaseInfo()
    }
  },
  setUUid () {
    if (!this.state.uuid) {
      this.state.uuid = generateUuid()
    }
  },
  setGeoInfo () {
    getGeoInfo().then((coordinates) => {
      this.state.coordinates = coordinates
    }, () => {})
  },
  setIp () {
    getIpAddress().then((ip) => {
      this.state.ip = ip
    }, () => {})
  },
  setNetwork () {
    getNetwork().then(({
      networkType,
      networkEffectiveType
    }) => {
      this.state.networkType = networkType
      this.state.networkEffectiveType = networkEffectiveType
    }, () => {})
  },
  setSdkInfo (version: string, buildTime: string) {
    this.state.sdkVersion = version
    this.state.sdkBuildTime = buildTime
  },
  getDebug () {
    return this.state?.debug ?? false
  },
  setDebug (debug: boolean) {
    this.state.debug = debug
  }
}

export default Store
