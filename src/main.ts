import { getBaseInfo } from './h5/h5BaseInfo'
import { type InitParams } from './types/index'
import log from './utils/log'

log.info('sdk init ...')

const initReport = async (params?: InitParams) => {
  log.info('initReport params', params)
  const baseInfo = await getBaseInfo()
  console.table(baseInfo)
  console.log(window.navigator.userAgent)
}

initReport().catch((error) => {
  console.log('initReport error', error)
})

export { initReport }
