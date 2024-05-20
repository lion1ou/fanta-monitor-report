import log from './log'
import Store from '../common/store'
import { REPORT_REQUIRED_FIELDS } from '../common/constant'

import { type IBaseInfo, type ITrackEvent, type InitParams } from '../types'

const paramsToString = (params: Record<string, any>) => {
  if (params && Object.keys(params).length) {
    const urlParams = Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&')
    return urlParams
  }
  return ''
}

const imgLoad = async (reportHost: string, params: any) => {
  return await new Promise((resolve, reject) => {
    const img = new Image(1, 1)
    img.onload = (e) => {
      log.info(`loaded:${JSON.stringify(e)}`)
      resolve({})
    }
    img.onerror = (e) => {
      log.info(`onerror:${JSON.stringify(e)}`)
      reject(e)
    }
    params.t = new Date().getTime()

    const urlParams = paramsToString(params)

    img.src = `${reportHost}?${urlParams}`
  })
}

const fetchReq = async (reportHost: string, params: any) => {
  const paramsString = paramsToString(params)
  return await fetch(`${reportHost}?${paramsString}`)
}

const sendBeacon = (reportHost: string, params: any) => {
  const res = navigator.sendBeacon(`${reportHost}?isBeacon=true`, JSON.stringify(params))
  return res
}

export const sendReport = async (reportData: InitParams & IBaseInfo & ITrackEvent) => {
  const reportHost = Store.getData('reportHost')
  if (!reportHost) {
    log.error('reportHost is empty')
  }
  const requiredParams = REPORT_REQUIRED_FIELDS || []
  const keys = Object.keys(reportData)
  const hasRequired = keys.filter(it => requiredParams.includes(it)).some(i =>
    reportData[i] === undefined || reportData[i] === null || reportData[i] === '')

  console.log('hasRequired', hasRequired)

  if (hasRequired) {
    log.error('reportData has required fields that are empty')
    return
  }

  try {
    const success = sendBeacon(reportHost, reportData)
    if (!success) {
      try {
        const res = await fetchReq(reportHost, reportData)
        console.log('fetchReq', res)
        if (res.status !== 200) {
          try {
            const res = await imgLoad(reportHost, reportData)
            console.log(res)
          } catch (error) {
            log.error(error)
          }
        }
      } catch (error) {
        try {
          const res = await imgLoad(reportHost, reportData)
          console.log(res)
        } catch (error) {
          log.error(error)
        }
      }
    }
  } catch (error) {
    try {
      const res = await imgLoad(reportHost, reportData)
      console.log(res)
    } catch (error) {
      log.error(error)
    }
  }
}
