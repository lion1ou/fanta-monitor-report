import { getApp } from './baseData/device'
import {InitParams} from './types/index'

console.log(getApp())
const initReport = (params: InitParams) => {
  console.log('initReport')

}

export {
  initReport
}