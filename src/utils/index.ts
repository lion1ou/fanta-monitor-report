// import Log from './log'

// let reportTime = 0
// const packageJson = require('../../package.json')
// const packageVersion = packageJson.version
// export const report = (data, logstore = 'h5-monitor') => {
//   const host = 'cn-hangzhou.log.aliyuncs.com'
//   const project = 'leoao-h5'
//   const reportUrl = `//${project}.${host}/logstores/${logstore}/track_ua.gif?APIVersion=0.6.0`
//   const reportData = { ...baseInfo(), ...data }

//   const img = new Image(1, 1)
//   img.onerror = function (e) {
//     // 这里可以进行重试操作
//     Log.internalError('请求失败：', e)
//     reportTime++
//     if (reportTime < 5) report(data, logstore)
//   }
//   const src = reportUrl + '&' + parseParam(reportData)

//   Log.info('上报数据', reportData)

//   img.src = src
// }

// // 参数编码返回字符串
// export const parseParam = (data) => {
//   let params = ''
//   for (const e in data) {
//     if (e && data[e]) {
//       const typeString = Object.prototype.toString.call(data[e])
//       if (typeString === '[object Object]' || typeString === '[object Array]') {
//         params += encodeURIComponent(e) + '=' + encodeURIComponent(JSON.stringify(data[e])) + '&'
//       } else {
//         params += encodeURIComponent(e) + '=' + encodeURIComponent(data[e]) + '&'
//       }
//     }
//   }
//   return params ? params.substring(0, params.length - 1) : params
// }

// export const baseInfo = () => {
//   const result = {}
//   const ua = window && window.navigator && window.navigator.userAgent ? window.navigator.userAgent : ''
//   const screen = window.screen ? window.screen : {}
//   const location = window.location ? window.location : {}
//   result.s_os = uaGetOs(ua)
//   result.s_version = packageVersion
//   result.s_app = uaGetApp(ua)
//   result.s_ua = ua
//   result.s_screen = screen.width + ' * ' + screen.height
//   result.s_href = location.href // 当前链接
//   result.s_path = location.pathname
//   result.s_host = location.hostname
//   result.s_project = h5Project(location)
//   return result
// }

// const uaGetOs = (ua) => {
//   // 测试条件：一个长度为100的数组，每个方法测试50次，取平均值。
//   // indexof 方法耗费时间： 0.048ms
//   // match 方法耗费时间： 0.178ms
//   // test 方法耗费时间： 0.039ms
//   let platform = 'Other'
//   if (/Android/.test(ua)) {
//     platform = 'Android'
//   }
//   if (/iPhone/.test(ua)) {
//     platform = 'iPhone'
//   }
//   if (/iPad/.test(ua)) {
//     platform = 'iPad'
//   }
//   if (/Windows/.test(ua)) {
//     platform = 'Windows'
//   }
//   if (!/like Mac/.test(ua) && /Mac OS X/.test(ua)) {
//     platform = 'Mac'
//   }
//   return platform
// }

// const uaGetApp = (ua) => {
//   let app = ''
//   if (/MicroMessenger/.test(ua)) {
//     app = ua.match(/MicroMessenger([A-Za-z0-9/.])*/) // 微信
//   }
//   if (/LEFIT/.test(ua)) {
//     app = ua.match(/LEFIT([A-Za-z0-9/.])*/) // 乐刻
//   }
//   if (/AlipayClient/.test(ua)) {
//     app = ua.match(/AlipayClient([A-Za-z0-9/.])*/) // 支付宝
//   }
//   if (/DingTalk/.test(ua)) {
//     app = ua.match(/DingTalk([A-Za-z0-9/.])*/) // 钉钉
//   }
//   return app ? app[0] : 'Other'
// }

// const h5Project = (location) => {
//   let result = location.href
//   if (result.indexOf('leoao') === -1 && result.indexOf('lefit') === -1) {
//     return result
//   }
//   // 默认传pathname
//   result = location.pathname
//   if (/[test-|uat-]*h5/.test(location.hostname) || /mlocal/.test(location.hostname)) {
//     if (location.pathname && location.pathname.slice(1)) {
//       result = location.pathname.slice(1).split('/')[0]
//     }
//   }
//   if (location.hostname === 'pt.leoao.com' || location.hostname === 'ptest.leoao.com') {
//     result = 'oldPtCoach'
//   }
//   if (location.href.indexOf('leCompanyWx') > -1) {
//     result = 'leCompanyWx'
//   }
//   if (location.href.indexOf('storeManager') > -1) {
//     result = 'storeManager'
//   }
//   return result
// }

// // 注册load事件 兼容方法
// export const addLoadEvent = (element, handler) => {
//   if (element.addEventListener) {
//     // 事件类型、需要执行的函数、是否捕捉
//     !element.complete && element.addEventListener('load', handler, false)
//   } else if (element.attachEvent) {
//     element.attachEvent('onreadystatechange', function () {
//       if (element.readyState === 'complete') {
//         handler.call(element)
//       }
//     })
//   } else {
//     element.onload = handler
//   }
// }

// // 移除load事件 兼容方法
// export const rmLoadEvent = (element, handler) => {
//   if (element.removeEventListener) {
//     element.removeEventListener('load', handler, false)
//   } else if (element.datachEvent) {
//     element.detachEvent('onreadystatechange', handler)
//   } else {
//     element.onload = null
//   }
// }

// export const addListener = (element, event, handler) => {
//   if (element.addEventListener) {
//     // 事件类型、需要执行的函数、是否捕捉
//     element.addEventListener(event, handler, false)
//   } else if (element.attachEvent) {
//     element.attachEvent(event, function () {
//       handler.call(element)
//     })
//   } else {
//     element[event] = handler
//   }
// }
