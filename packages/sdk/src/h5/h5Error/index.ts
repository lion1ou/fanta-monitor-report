export type ErrorKind = 'js' | 'promise' | 'resource'

export interface ErrorData {
  kind: ErrorKind
  name: string
  message: string
  stack: string
  filename?: string
  lineno?: number
  colno?: number
  tagName?: string
  url?: string
}

type Reporter = (data: ErrorData) => void

const STACK_LIMIT = 4000
const DEDUPE_WINDOW = 1000

const stringify = (value: unknown): string => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}

export const normalizeError = (value: unknown): ErrorData => {
  if (value instanceof Error) {
    return { kind: 'js', name: value.name, message: value.message, stack: (value.stack ?? '').slice(0, STACK_LIMIT) }
  }
  return { kind: 'js', name: 'Error', message: stringify(value), stack: '' }
}

const resourceUrl = (target: EventTarget): string => {
  const el = target as HTMLElement & { src?: string, href?: string }
  return el.src ?? el.href ?? ''
}

// 监听 JS 错误、未处理的 Promise 拒绝、资源加载失败；同一错误 1 秒内只上报一次
export const startErrorCapture = (report: Reporter) => {
  const recent = new Map<string, number>()
  const emit = (data: ErrorData) => {
    const key = `${data.kind}|${data.message}|${data.filename ?? data.url ?? ''}|${data.lineno ?? ''}|${data.colno ?? ''}`
    const now = Date.now()
    const last = recent.get(key)
    if (last !== undefined && now - last < DEDUPE_WINDOW) return
    recent.set(key, now)
    report(data)
  }

  window.addEventListener('error', (event: Event) => {
    if (event instanceof ErrorEvent) {
      const base = normalizeError(event.error ?? event.message)
      emit({ ...base, message: event.message || base.message, filename: event.filename, lineno: event.lineno, colno: event.colno })
      return
    }
    const target = event.target
    if (target && target !== window && target instanceof Element) {
      emit({ kind: 'resource', name: 'ResourceError', message: `load failed: ${target.tagName}`, stack: '', tagName: target.tagName, url: resourceUrl(target) })
    }
  }, true)

  window.addEventListener('unhandledrejection', (event: Event) => {
    const reason = (event as Event & { reason?: unknown }).reason
    emit({ ...normalizeError(reason), kind: 'promise' })
  })
}
