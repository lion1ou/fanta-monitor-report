// 'use strict'
// import { report } from '../utils'

// export default class Visitor {
//   start() {
//     window.addEventListener('pageshow', () => this.onPageEnterAndLeave('pageshow'))
//     window.addEventListener('popstate', () => this.onPageEnterAndLeave('popstate')) // 浏览器前进或者后退(location.href不会触发)
//     window.addEventListener('pushState', () => this.onPageEnterAndLeave('pushState')) // 进入页面
//     window.addEventListener('replaceState', () => this.onPageEnterAndLeave('replaceState')) // 页面替换
//   }

//   onPageEnterAndLeave(eventName) {
//     const reportData = {
//       v_event_name: eventName,
//       v_refer: '',
//       v_args: JSON.stringify(this.getUrlParam(window.location.href))
//     }
//     // 获取track埋点库的路由栈
//     const routeStack = this.getRouteStack() || []
//     const len = routeStack.length

//     if (eventName === 'replaceState') {
//       // 路由堆栈不存在(首次触发)或者堆栈最新的路由和当前路由相同，不触发任何日志操作
//       if (!routeStack[len - 1] || routeStack[len - 1] === window.location.href) {
//         return
//       }
//     }

//     // 没有路由堆栈，说明第一次打开页面，没有refer
//     if (len) {
//       reportData.v_refer = routeStack[len - 1]
//     }

//     if (window.requestIdleCallback) {
//       window.requestIdleCallback(() => {
//         report({ s_type: 'visitor', ...reportData })
//       })
//     } else {
//       const sT = setTimeout(() => {
//         report({ s_type: 'visitor', ...reportData })
//         clearTimeout(sT)
//       }, 0)
//     }
//   }

//   // 设置路由堆栈
//   setRouteStack(value) {
//     sessionStorage.setItem('routeStack', JSON.stringify(value))
//   }

//   // 获取路由堆栈
//   getRouteStack() {
//     const value = sessionStorage.getItem('routeStack')
//     return value && JSON.parse(value)
//   }

//   // 获取url参数
//   getUrlParam(url) {
//     const list = (url || window.location.href).match(/[?&][^=]*=[^?&=]*/g) || []
//     return list.reduce((params, str) => {
//       const [key, value] = str.slice(1).split('=')
//       params[key] = value
//       return params
//     }, {})
//   }
// }
