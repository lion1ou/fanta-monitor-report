// declare let wx: any
// declare let dd: any
// declare let navigator: any

// function getNetSpeed (url: string, times: number): number {
//   return new Promise((resolve, reject) => {
//     // downlink测算网速
//     const connection = window.navigator.connection
//     if (connection?.downlink) {
//       resolve((connection.downlink * 1024) / 8)
//     }
//     // 多次测速求平均值
//     const arr = []
//     for (let i = 0; i < times; i++) {
//       arr.push(getSpeedWithAjax(url))
//     }
//     Promise.all(arr).then((speeds) => {
//       let sum = 0
//       speeds.forEach((speed) => {
//         sum += Number(speed)
//       })
//       resolve(sum / times)
//     })
//   })
// }

// async function getSpeedWithAjax (url: string): Promise<number> {
//   return await new Promise((resolve, reject) => {
//     try {
//       let start: any = null
//       let end = null
//       start = new Date().getTime()
//       const xhr = new XMLHttpRequest()
//       xhr.onreadystatechange = function () {
//         if (xhr.readyState === 4) {
//           end = new Date().getTime()
//           const length = Number(xhr.getResponseHeader('Content-Length')) || 0
//           const size = length / 1024
//           const speed = Number((size * 1000) / (end - start)) || 0
//           resolve(speed)
//         }
//       }
//       xhr.open('GET', url)
//       xhr.send()
//     } catch (error) {
//       reject(error)
//     }
//   })
// }

// function isWifi (): boolean {
//   try {
//     let wifi = true
//     const ua = window.navigator.userAgent
//     const conn = window.navigator.connection
//     // 判断是否微信环境
//     if (ua.includes('MicroMessenger')) {
//       if (ua.includes('WIFI')) {
//         return true
//       } else {
//         wifi = false
//       }
//       // 判断是否支持navigator.connection
//     } else if (conn) {
//       wifi = conn.type === 'wifi'
//     }
//     return wifi
//   } catch (e) {
//     return false
//   }
// }

// async function getType (): Promise<{
//   nType: string
//   nEffectiveType: string
// }> {
//   return await new Promise((resolve, reject) => {
//     if (wx) {
//       wx.getNetworkType({
//         success: function (res: any) {
//           const networkType = res.networkType // 返回网络类型2g，3g，4g，wifi
//           resolve({
//             nType: networkType,
//             nEffectiveType: 'unknown'
//           })
//         }
//       })
//     } else if (dd) {
//       dd.device.connection.getNetworkType({
//         onSuccess: function (data: string) {
//           resolve({
//             nType: data,
//             nEffectiveType: 'unknown'
//           })
//         },
//         onFail: function (err: any) {
//           reject(err)
//         }
//       })
//     } else {
//       const network = navigator.connection || navigator.mozConnection || navigator.webkitConnection
//       resolve({
//         nType: isWifi() ? 'wifi' : network.type || 'unknown', // 链接类型，bluetooth cellular ethernet none wifi wimax other unknown
//         nEffectiveType: network.effectiveType || 'unknown' // 返回连接的有效类型，比如 “slow-2g”，“2g”，“3g” 或 “4g”
//       })
//     }
//   })
// }

// const getNetwork = async () => {
//   if (!navigator || typeof navigator !== 'object') {
//     return null
//   }
//   const { nType, nEffectiveType } = await getType()

//   return {
//     nType,
//     nEffectiveType
//   }
// }

// export { getNetSpeed, getSpeedWithAjax, getType, getNetwork }
