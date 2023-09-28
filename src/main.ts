import { getApp } from './baseData/device'
import { type InitParams } from './types/index'

const a = getApp()
console.log(a)

const initReport = (params: InitParams) => {
  console.log('initReport')
}

export { initReport }
