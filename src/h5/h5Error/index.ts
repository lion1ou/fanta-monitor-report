// 'use strict'
// import { report } from '../utils'

// export default class ErrorReport {
//   start () {
//     // 监听资源错误
//     window.addEventListener(
//       'error',
//       (e) => {
//         // 避免重复上报
//         if (e.target !== window) {
//           const tempPath = e.path || (e.composedPath && e.composedPath())
//           const path = tempPath?.length ? tempPath.map((item) => `${(item.nodeName || '').toLowerCase()}${item.className ? '.' + item.className : ''}`).join(' < ') : ''
//           reportError({ e_name: 'addEventListenerError', e_msg: nodeToString(e.target).replace('<', '<').replace('>', '>'), e_stack: path })
//         }
//       },
//       true
//     )

//     // 监听js错误
//     window.onerror = function (msg, url, row, col, error) {
//       if (msg && url && row && col && error) {
//         reportError({ e_name: 'onError', e_msg: error.message, e_stack: error.stack })
//       }
//     }

//     // 监听promise相关报错
//     window.addEventListener(
//       'unhandledrejection',
//       (e) => {
//         if (e.reason) {
//           reportError({ e_name: 'unhandledRejection', e_msg: e.reason.message, e_stack: e.reason.stack })
//         }
//       },
//       true
//     )

//     // 监听console.error
//     const consoleError = window.console.error
//     window.console.error = function (e) {
//       if (e.name || e.message) {
//         reportError({ e_name: 'consoleError', e_msg: e.message, e_stack: e.stack })
//       }
//       consoleError && consoleError.apply(window, arguments)
//     }

//     // 将DOM转成字符串
//     function nodeToString (node) {
//       let tmpNode = document.createElement('div')
//       tmpNode.appendChild(node.cloneNode(true))
//       const str = tmpNode.innerHTML
//       tmpNode = node = null // prevent memory leaks in IE
//       return str
//     }

//     function reportError (data) {
//       data.e_stack = data.e_stack ? data.e_stack.slice(0, 1000) : '' // stack数据太长，无法上报
//       if (window.requestIdleCallback) {
//         window.requestIdleCallback(() => {
//           report({ s_type: 'error', ...data })
//         })
//       } else {
//         const sT = setTimeout(() => {
//           report({ s_type: 'error', ...data })
//           clearTimeout(sT)
//         }, 0)
//       }
//     }
//   }
// }
