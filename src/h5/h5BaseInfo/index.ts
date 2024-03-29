import { getBrower, getOS, getDeviceType, getBrowerEngine, getOrientation, getScreenInfo, getMobileModel } from './device'
import { getIp, getNetworkType, getGeo } from './other'
import { getLocation } from './location'
import { getLocal, getUUID, setLocal } from '../../utils'
import { UUID_LOCAL_KEY } from '../../common/constant'

export const getBaseInfo = async () => {
  const { userAgent, language } = window.navigator
  const { os, osVersion } = getOS()
  const { browser, browserVersion, isBot, isWebview } = getBrower()
  const browserEngine = getBrowerEngine()
  const deviceType = getDeviceType()
  const ip = await getIp()
  const orientation = getOrientation()
  const { screenWidth, screenHeight, viewportWidth, viewportHeight } = getScreenInfo()
  const { mobileBrand, mobileModel } = getMobileModel()
  const res = await getGeo()
  const coordinates = res && res.flag === 'success' ? `${res.location.lng},${res.location.lat}` : ''
  const { networkType, networkEffectiveType } = await getNetworkType()
  const location = getLocation()

  const uuid = () => {
    const id = getLocal('uuid') ?? getUUID()
    setLocal(UUID_LOCAL_KEY, id)
    return id
  }

  return {
    userAgent, // 浏览器信息
    deviceType, // 设备类型
    mobileBrand,
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
    coordinates, // 经纬度 逗号分隔 `经度(longitude),纬度(latitude)`
    networkType, // 网络类型
    networkEffectiveType, // 网络连接类型
    ip,
    uuid: uuid(),
    location
  }
}
