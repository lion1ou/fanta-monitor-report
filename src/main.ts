import baseInfo from './h5/h5BaseInfo'
import { type InitParams } from './types/index'
import log from './utils/log'
import { getIp } from './utils/index'

log.info('sdk init ...')

const initReport = async (params?: InitParams) => {
  log.info('initReport params', params)
  console.table(baseInfo)
  const res = await getIp()
  log.info('initReport', res)
}

initReport().catch((error) => {
  console.log('initReport error', error)
})

export { initReport }
