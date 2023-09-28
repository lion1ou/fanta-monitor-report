// 'use strict'
// import { report, addLoadEvent, rmLoadEvent, addListener } from '../utils'
// export default class PerformanceReport {
//   constructor (data = {}) {
//     this.codeStartTime = +new Date()
//     this.loopLimitTimes = data.loopLimitTimes || 8 // 循环获取图片次数限制
//     this.loopInterval = data.loopInterval || 500 // 循环间隔
//     this.reportTimeout = data.reportTimeout || 5000 // 上报延迟时机
//     this.loadedImgs = [] // img标签图片的加载时间
//     this.bgLoadedImgs = [] // css背景图的加载时间
//     this.firstScreenLoadedImgs = [] // 首屏图片的加载时间
//     this.bgImgUrlArr = [] // css背景图url数组用于去重判断
//     this.loopTimes = 0
//     this.sT = null
//   }

//   start () {
//     this.findImgs()
//     // 循环获取img标签
//     const sI = setInterval(() => {
//       if (this.loopTimes < this.loopLimitTimes) {
//         this.loopTimes++
//         this.findImgs()
//         this.findBgImgs()
//       } else {
//         clearInterval(sI)
//       }
//     }, this.loopInterval)
//     // onload 之后上报数据
//     addListener(window, 'load', () => {
//       if (this.sT) {
//         clearTimeout(this.sT)
//         this.sT = null
//       }
//       this.sT = setTimeout(() => {
//         if (this.sT) {
//           clearTimeout(this.sT)
//           this.sT = null
//         }
//         this.calculateTime()
//       }, this.reportTimeout)
//     })

//     // 防止还没上传时就已经关闭页面
//     addListener(window, 'beforeunload', () => {
//       if (this.sT) {
//         clearTimeout(this.sT)
//         this.sT = null
//         this.calculateTime()
//       }
//     })
//   }

//   getBaseTime () {
//     // 获取基础性能时间
//     const obj = {}
//     const { timing, navigation } = performance
//     const originTime = this.getOriginTime()
//     if (navigation) {
//       obj.redirectCount = navigation.redirectCount || 0 // 重定向次数
//     }
//     obj.timeDeviation = this.codeStartTime - window.performance.timing.navigationStart // 开始时间的差距
//     if (performance.getEntriesByType && (performance.getEntriesByType('navigation').length > 0)) {
//       const timeLevel2 = performance.getEntriesByType('navigation')[0] // 返回的是相对时间
//       obj.support = 'level2' // 是否支持performance
//       obj.redirectTime = timeLevel2.redirectEnd - timeLevel2.redirectStart // 重定向时间 第一个 HTTP 重定向发生时的时间。有跳转且是同域名内的重定向才算，否则两个都为值为 0
//       obj.dnsTime = timeLevel2.domainLookupEnd - timeLevel2.domainLookupStart // DNS解析时间
//       obj.tcpTime = timeLevel2.connectEnd - timeLevel2.connectStart // TCP完成握手时间
//       obj.ajaxTime = timeLevel2.responseEnd - timeLevel2.requestStart // HTTP请求响应完成时间
//       obj.domTime = timeLevel2.domComplete - timeLevel2.domInteractive // DOM结构解析完成时间
//       obj.onLoadTime = timeLevel2.loadEventEnd - timeLevel2.startTime // 完全加载时间
//     } else {
//       obj.support = 'level1' // 是否支持performance
//       obj.redirectTime = timing.redirectEnd - timing.redirectStart // 重定向时间
//       obj.dnsTime = timing.domainLookupEnd - timing.domainLookupStart // DNS解析时间
//       obj.tcpTime = timing.connectEnd - timing.connectStart // TCP完成握手时间
//       obj.ajaxTime = timing.responseEnd - timing.requestStart // 网页HTTP请求响应完成时间
//       obj.domTime = timing.domComplete - timing.domLoading // DOM加载完成时间
//       obj.onLoadTime = timing.loadEventEnd - originTime // onload事件时间
//     }

//     return obj
//   }

//   // 计算首屏时间
//   calculateTime () {
//     let obj = { support: 'false' }
//     const originTime = this.getOriginTime()
//     try {
//       const allImageArr = this.loadedImgs.concat(this.bgLoadedImgs)
//       const { timing } = performance

//       obj = Object.assign({}, obj, this.getBaseTime())

//       // obj.whiteScreenTime = timing.domLoading - originTime  // 网上找到的，但是我觉得下面更合理
//       obj.whiteScreenTime = timing.domInteractive - originTime

//       // 首屏加载时间
//       // 如果没有图片，直接取dom时间，DOMContentLoaded事件完成时，此刻用户可以对页面进行操作(用户可操作时间节点)
//       const firstScreenTime = this.maxTime(this.firstScreenLoadedImgs) >= timing.domContentLoadedEventEnd ? this.maxTime(this.firstScreenLoadedImgs) : timing.domContentLoadedEventEnd
//       obj.firstScreenLoadTime = firstScreenTime - originTime

//       // 所有监听到的图片耗时（已经加载完成的不包含）
//       const fullScreenTime = this.maxTime(allImageArr) >= timing.domComplete ? this.maxTime(allImageArr) : timing.domComplete
//       obj.fullScreenLoadTime1 = fullScreenTime - originTime

//       if (performance.getEntriesByType && (performance.getEntriesByType('navigation').length > 0) && (performance.getEntriesByType('resource').length > 0)) {
//         const timging2 = performance.getEntriesByType('navigation')[0] // 返回的是相对时间
//         const resourceList = performance.getEntriesByType('resource')
//         let lastItem = {
//           responseEnd: 0
//         }
//         resourceList.map((item) => {
//           // 判断onload 之前发起的图片请求，排除用户交互之后的图片加载
//           if (item.initiatorType === 'img' && item.startTime < timging2.loadEventEnd && item.name.indexOf('http://leoao-h5.cn-hangzhou.log.aliyuncs.com') === -1) {
//             if (item.responseEnd > lastItem.responseEnd) {
//               lastItem = JSON.parse(JSON.stringify(item))
//             }
//           }
//         })
//         obj.fullScreenLoadTime2 = lastItem.responseEnd >= timging2.domComplete ? lastItem.responseEnd : timging2.domComplete // 使用level2 新api 计算的所有图片资源的耗时
//       }

//       // FP 和 FCP 时间
//       if (performance.getEntriesByType && (performance.getEntriesByType('paint').length > 0)) {
//         const paintList = performance.getEntriesByType('paint')
//         paintList.map((item) => {
//           if (item.name === 'first-contentful-paint') {
//             obj.fcp = item.startTime
//           }
//           if (item.name === 'first-paint') {
//             obj.fp = item.startTime
//           }
//         })
//       }

//       this.postTimeDataToAli(obj)
//     } catch (error) {
//       console.error(obj, error)
//     }
//   }

//   // 获取img标签 注册监听事件
//   findImgs () {
//     const loadEvent = ({ target }) => {
//       const img = target
//       // 加载完成事件
//       rmLoadEvent(img, loadEvent)
//       const curTime = +new Date()
//       const index = this.loadedImgs.findIndex((item) => item.url === img.src)
//       if (index === -1) {
//         this.loadedImgs.push({ img, time: curTime, url: img.src })
//         if (this.inFirstScreen(img)) {
//           this.firstScreenLoadedImgs.push({ img, time: curTime })
//         }
//       } else {
//         // 晚的时间替换之前的时间
//         this.loadedImgs[index] = { img, time: curTime, url: img.src }
//         if (this.inFirstScreen(img)) {
//           this.firstScreenLoadedImgs[index] = { img, time: curTime }
//         }
//       }
//     }
//     const imgs = document.getElementsByTagName('img')
//     for (let i = 0; i < imgs.length; i++) {
//       const img = imgs[i]
//       if (this.isVisible(img)) {
//         addLoadEvent(img, loadEvent)
//       }
//     }
//   }

//   // 获取css背景图片 注册监听事件
//   findBgImgs () {
//     const srcChecker = /url\(\s*?['"]?\s*?(http[s]?\S+?)\s*?["']?\s*?\)/i
//     const domList = document.querySelectorAll('div, span, p, h1, h2, h3, h4, h5, h6, i, b')
//     Array.prototype.slice.call(domList).forEach((element) => {
//       // 获取background-image的链接
//       const bgUrlCss = window.getComputedStyle(element, null).getPropertyValue('background-image')
//       const match = srcChecker.exec(bgUrlCss)
//       const bgUrl = match ? match[1] : ''
//       if (bgUrl && this.isVisible(element) && this.bgImgUrlArr.indexOf(bgUrl) === -1) {
//         this.bgImgUrlArr.push(bgUrl)
//         const img = new Image()
//         img.onload = () => {
//           if (this.inFirstScreen(element)) {
//             // 背景图已经判断过，是否在首屏，加载后直接添加到时间数组里
//             this.firstScreenLoadedImgs.push({ img, time: +new Date() })
//           }
//           this.bgLoadedImgs.push({ img, time: +new Date(), url: match[1] })
//         }
//         img.src = match[1]
//       }
//     })
//   }

//   // 元素是否在首屏
//   inFirstScreen (ele) {
//     const ch = document.documentElement.clientHeight
//     let top = window.pageYOffset || document.documentElement.scrollTop
//     top += ele.getBoundingClientRect().top
//     return (top > 0 && top < ch) || top === 0
//   }

//   // 时间最大值
//   maxTime (arr, sTime) {
//     let max = sTime || 0
//     if (Object.prototype.toString.call(arr) === '[object Array]') {
//       for (let i = 0; i < arr.length; i++) {
//         if (arr[i]?.time) {
//           max = arr[i].time > max ? arr[i].time : max
//         }
//       }
//     }
//     return max
//   }

//   isVisible (ele) {
//     // 判断元素是否显示
//     // true为显示，false为隐藏
//     const html = document.getElementsByTagName('html')[0].nodeName
//     if (!ele || html === ele.nodeName) return true
//     const style = window.getComputedStyle(ele)
//     return style.width !== 0 && style.height !== 0 && style.opacity !== 0 && style.display !== 'none' && style.visibility !== 'hidden' && this.isVisible(ele.parentNode)
//   }

//   getOriginTime () {
//     // 计算时用哪个当做原始时间
//     // 原因：客户端对集市页面做了预加载操作，导致navigationStart时间过早，使最终计算的时间有很大偏差
//     // 这里利用codeStartTime(代码开始执行时间)和navigationStart时间作比较，偏差过大时，使用代码开始时间代替
//     const timeDeviation = this.codeStartTime - window.performance.timing.navigationStart
//     return timeDeviation > 3 * 1000 ? this.codeStartTime : window.performance.timing.navigationStart
//   }

//   // 上报数据
//   postTimeDataToAli (params) {
//     const result = {}
//     for (const key in params) {
//       result[`p_${key}`] = !params[key] || params[key] < 0 ? 0 : typeof params[key] === 'string' ? params[key] : Math.round(params[key])
//     }
//     if (window.requestIdleCallback) {
//       window.requestIdleCallback(() => {
//         report({ s_type: 'performance', ...result })
//       })
//     } else {
//       const sT = setTimeout(() => {
//         report({ s_type: 'performance', ...result })
//         clearTimeout(sT)
//       }, 0)
//     }
//   }
// }
