import { type InitParams, type ITrackEvent } from './types/index'
import Store from './common/store'
import log from './utils/log'
import { sendReport } from './common/report'
import { TrackType } from './types/enum'
import { getUUID } from './utils'

log.info('sdk init ...')

const initReport = async (params?: InitParams) => {
  try {
    log.info('initReport params', params)
    if (!params?.reportHost) {
      log.error('reportHost未配置，请添加上报接口')
    }
    if (!params?.appName) {
      log.error('appName未配置，请添加上报接口')
    }
    Store.setParams(params)
    Store.initData()
  } catch (error) {
    throw new Error('初始化失败')
  }
}

const track = async (type: TrackType, customData?: any) => {
  log.info('track', type)
  const baseInfo = Store.getData()
  const trackData: ITrackEvent = {
    trackType: type,
    trackData: JSON.stringify(customData ?? {}),
    trackTime: new Date().getTime(),
    trackId: getUUID()
  }

  const reportData = {
    ...baseInfo,
    ...trackData
  }
  await sendReport(reportData)
}

const pageView = async (customData: any) => {
  await track(TrackType.PageView, customData);
}

const click = async (customData: any) => {
  await track(TrackType.Click, customData);
}

const error = async (customData: any) => {
  await track(TrackType.Error, customData);
}

const custom = async (customData: any) => {
  await track(TrackType.Custom, customData);
}

export { initReport, pageView, click, error, custom }
