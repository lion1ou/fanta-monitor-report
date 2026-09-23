import type { TrackType } from '@fanta/shared'
import type { InitParams, TrackData } from './types'
import Store from './common/store'
import log from './common/log'
import { EventQueue } from './common/queue'
import { createTransport } from './common/transport'
import { touchSession } from './common/session'
import { getUUID } from './common/utils'
import { QUEUE_LOCAL_KEY, QUEUE_MAX_STORED, QUEUE_MAX_ATTEMPTS } from './common/constant'
import { getPageInfo } from './h5/h5BaseInfo/location'
import { startPageVisit } from './h5/h5PageVisit'
import { startErrorCapture } from './h5/h5Error'
import { startPerformance } from './h5/h5Performance'

const version = '__VERSION__'
const env = '__ENV__'

let queue: EventQueue | null = null

// 组装完整事件并入队；页面信息与会话在每次上报时实时读取
const track = (trackType: TrackType, trackData: TrackData = {}) => {
  if (!queue) {
    log.error('请先调用 initReport')
    return
  }
  queue.push({
    ...Store.getContext(),
    ...getPageInfo(),
    sessionId: touchSession(),
    trackId: getUUID(),
    trackType,
    trackTime: Date.now(),
    trackData
  })
}

const initReport = (params: InitParams) => {
  if (!params?.reportHost) throw new Error('[fanta-report] reportHost 未配置')
  if (!params.appName) throw new Error('[fanta-report] appName 未配置')
  Store.init(params, { version, env })
  const { reportHost, enableImgFallback, batchSize, flushInterval, autoTrack } = Store.config
  queue = new EventQueue({
    send: createTransport({ reportHost, enableImgFallback }),
    batchSize,
    flushInterval,
    storageKey: QUEUE_LOCAL_KEY,
    maxStored: QUEUE_MAX_STORED,
    maxAttempts: QUEUE_MAX_ATTEMPTS
  })
  if (autoTrack.pageView) startPageVisit((data) => { track('PageView', { ...data }); })
  if (autoTrack.error) startErrorCapture((data) => { track('Error', { ...data }); })
  if (autoTrack.performance) startPerformance((data) => { track('Performance', { ...data }); })
  log.info('sdk init done', Store.config)
}

const pageView = (data: TrackData = {}) => { track('PageView', { trigger: 'manual', ...data }); }
const click = (data: TrackData = {}) => { track('Click', data); }
const error = (data: TrackData = {}) => { track('Error', data); }
const custom = (data: TrackData = {}) => { track('Custom', data); }
const setUserId = (userId: string) => { Store.setUserId(userId); }
const flush = async () => { await queue?.flush() }

export { initReport, pageView, click, error, custom, setUserId, flush, version, env }
