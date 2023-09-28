import { getApp } from './h5/h5BaseInfo/device'
import { type InitParams } from './types/index'
import log from './utils/log'
import { getIp } from './utils/'

const a = getApp()
log.info(a)

const initReport = async (params?: InitParams) => {
  const res = await getIp()
  console.log('initReport', res)
}

initReport().catch((error) => {
  console.log('initReport error', error)
})

export { initReport }
