// 获取网络类型
import axios from 'axios'
import log from '../../utils/log'

declare const navigator: any

export const getIp = async (): Promise<string> => {
  const res = await axios.get('https://api.ipify.org?format=json')
  return res.data.ip
}

function isWifi (): boolean {
  try {
    let wifi = true
    const ua = navigator.userAgent
    const conn = navigator.connection
    // 判断是否微信环境
    if (ua.includes('MicroMessenger')) {
      if (ua.includes('WIFI')) {
        return true
      } else {
        wifi = false
      }
      // 判断是否支持navigator.connection
    } else if (conn) {
      wifi = conn.type === 'wifi'
    }
    return wifi
  } catch (e) {
    return false
  }
}

export const getNetworkType = async (): Promise<{
  networkType: string
  networkEffectiveType: string
  networkSpeed: number
  networkSpeedUnit: string
}> => {
  const networkSpeed = await getNetSpeed('https://www.baidu.com/', 5) || 0
  return await new Promise((resolve, reject) => {
    const network = navigator.connection || navigator.mozConnection || navigator.webkitConnection
    resolve({
      networkType: isWifi() ? 'wifi' : network.type || 'unknown', // 链接类型，bluetooth cellular ethernet none wifi wimax other unknown
      networkEffectiveType: network.effectiveType || 'unknown', // 返回连接的有效类型，比如 “slow-2g”，“2g”，“3g” 或 “4g”
      networkSpeed, // 单位：KB/ms
      networkSpeedUnit: 'kb/ms'
    })
  })
}

// TODO: 获取网速值不可靠
// https://github.com/zhaoyiming0803/network-speed
async function getNetSpeed (url: string, times: number): Promise<number> {
  return await new Promise((resolve, reject) => {
    // downlink测算网速, KB/ms
    const connection = navigator.connection
    if (connection?.downlink) {
      resolve((connection.downlink * 1024) / 8)
    }
    // 多次测速求平均值
    const arr = []
    for (let i = 0; i < times; i++) {
      arr.push(getSpeedWithAjax(url))
    }
    Promise.all(arr).then((speeds) => {
      let sum = 0
      speeds.forEach((speed) => {
        sum += Number(speed)
      })
      resolve(sum / times)
    }).catch((err) => {
      log.error('getNetSpeed:Error', err)
      reject(err)
    })
  })
}

async function getSpeedWithAjax (url: string): Promise<number> {
  return await new Promise((resolve, reject) => {
    try {
      let start: any = null
      let end = null
      start = new Date().getTime()
      const xhr = new XMLHttpRequest()
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          end = new Date().getTime()
          const length = Number(xhr.getResponseHeader('Content-Length')) || 0
          console.log(length)
          const size = length / 1024
          const speed = Number((size * 1000) / (end - start)) || 0
          resolve(speed)
        }
      }
      xhr.onerror = (e) => {
        log.error(e)
        reject(e)
      }
      xhr.open('GET', url)
      xhr.send()
    } catch (error) {
      reject(error)
    }
  })
}
