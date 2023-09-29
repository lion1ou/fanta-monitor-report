import { getBrower, getOS } from './device'

const { userAgent } = window.navigator
const { os, osVersion } = getOS()
const { browser, browserVersion } = getBrower()

const baseInfo = {
  userAgent,
  os,
  osVersion,
  browser,
  browserVersion
}

export default baseInfo
