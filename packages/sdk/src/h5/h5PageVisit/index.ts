export type PageVisitTrigger = 'init' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange'

export interface PageVisitData {
  trigger: PageVisitTrigger
  from: string
}

type Reporter = (data: PageVisitData) => void

let patched = false

// 首屏立即上报；劫持 History API 并监听 popstate/hashchange 覆盖 SPA 路由；URL 未变化不重复上报
export const startPageVisit = (report: Reporter) => {
  let current = window.location.href
  report({ trigger: 'init', from: '' })

  const emit = (trigger: PageVisitTrigger) => {
    const next = window.location.href
    if (next === current) return
    const from = current
    current = next
    report({ trigger, from })
  }

  if (!patched) {
    patched = true
    const wrap = (method: 'pushState' | 'replaceState') => {
      const original = window.history[method]
      window.history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        original.apply(this, args)
        window.dispatchEvent(new Event(`fanta:${method}`))
      }
    }
    wrap('pushState')
    wrap('replaceState')
  }

  window.addEventListener('fanta:pushState', () => { emit('pushState'); })
  window.addEventListener('fanta:replaceState', () => { emit('replaceState'); })
  window.addEventListener('popstate', () => { emit('popstate'); })
  window.addEventListener('hashchange', () => { emit('hashchange'); })
}
