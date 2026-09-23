import { getBrower, getOS, getDeviceType, getBrowerEngine, getOrientation, getScreenInfo, getMobileModel } from './device'
import { getNetworkType, getGeo } from './other'
import type { DeviceInfo } from '../../types'
import log from '../../common/log'
import fingerprinting from './fingerprint'

export const getBaseInfo = (): DeviceInfo => {
  const { userAgent, language } = window.navigator
  const result: DeviceInfo = {
    userAgent,
    language,
    ...getOS(),
    ...getBrower(),
    browserEngine: getBrowerEngine(),
    deviceType: getDeviceType(),
    orientation: getOrientation(),
    ...getScreenInfo(),
    ...getMobileModel()
  }
  log.info('getBaseInfo', result)
  return result
}

// canvas 指纹是同步计算，初始化时直接写入上下文，保证首条事件带指纹
export const getFingerPrint = (): { fingerPrint: string, fingerPrintCanvas: string } => {
  try {
    const { hash, fingerPrint } = fingerprinting()
    return { fingerPrintCanvas: hash, fingerPrint }
  } catch (error) {
    log.error('get finger print error', error)
    return { fingerPrintCanvas: '', fingerPrint: '' }
  }
}

// 经纬度，逗号分隔 `经度,纬度`；获取失败返回空字符串
export const getGeoInfo = async (): Promise<string> => {
  const res = await getGeo()
  return res?.flag === 'success' ? `${res.location.lng},${res.location.lat}` : ''
}

export const getNetwork = getNetworkType
