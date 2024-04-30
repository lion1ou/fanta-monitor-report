import { getBrower, getOS, getDeviceType, getBrowerEngine, getOrientation, getScreenInfo, getMobileModel } from './device'
import { getIp, getNetworkType, getGeo, uuid } from './other'
import { getLocation } from './location'
import { type IBaseInfo } from '../../types/index'
import log from '../../common/log'

export const getBaseInfo = (): IBaseInfo => {
  const { userAgent, language } = window.navigator
  const { os, osVersion } = getOS()
  const { browser, browserVersion, isBot, isWebview } = getBrower()
  const browserEngine = getBrowerEngine()
  const deviceType = getDeviceType()
  const orientation = getOrientation()
  const { screenWidth, screenHeight, viewportWidth, viewportHeight } = getScreenInfo()
  const { mobileBrand, mobileModel } = getMobileModel()

  const { pagePath, pageOrigin, pageSearch, pageProtocol } = getLocation()
  const result = {
    userAgent, // 浏览器信息
    deviceType, // 设备类型
    mobileBrand, // 手机品牌
    mobileModel, // 手机型号
    os, // 操作系统
    osVersion, // 操作系统版本
    browser, // 浏览器名称
    browserVersion, // 浏览器版本
    browserEngine, // 浏览器引擎
    isBot, // 是否机器人
    isWebview, // 是否webview
    language, // 当前语言
    orientation, // 屏幕方向
    screenWidth, // 屏幕宽度
    screenHeight, // 屏幕高度
    viewportWidth, // 可视区域宽度
    viewportHeight, // 可视区域高度
    pagePath,
    pageOrigin,
    pageSearch,
    pageProtocol
  }
  log.info('getBaseInfo', result)
  return result
}

export const generateUuid = () => {
  const result = uuid()
  log.info('generateUuid', result)
  return result
}

export const getGeoInfo = async () => {
  // 经纬度 逗号分隔 `经度(longitude),纬度(latitude)`
  const res = await getGeo()
  const coordinates = res && res.flag === 'success' ? `${res.location.lng},${res.location.lat}` : ''
  log.info('getGeoInfo', coordinates)
  return coordinates
}

export const getIpAddress = async () => {
  const result = await getIp()
  log.info('getIpAddress', result)
  return result
}

export const getNetwork = async () => {
  const result = await getNetworkType()
  log.info('getNetwork', result)
  return result
}
