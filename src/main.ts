import device from './h5/h5BaseInfo/device'
import { type InitParams } from './types/index'
import log from './utils/log'
import { getIp } from './utils/'

const initReport = async (params?: InitParams) => {
  log.info('device', device)
  const res = await getIp()
  log.info('initReport', res)
}

initReport().catch((error) => {
  console.log('initReport error', error)
})

export { initReport }
