import type { TrackEvent } from '@fanta/shared'
import log from './log'

export type SendResult = 'sent' | 'retry' | 'drop'
export type SendBatch = (events: TrackEvent[]) => Promise<SendResult>

interface TransportOptions {
  reportHost: string
  enableImgFallback: boolean
}

// 浏览器端 base64url，像素上报用它把事件 JSON 放进 query
export const toBase64Url = (text: string): string => {
  let binary = ''
  new TextEncoder().encode(text).forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const loadPixel = async (url: string): Promise<boolean> => await new Promise((resolve) => {
  const img = new Image(1, 1)
  img.onload = () => { resolve(true); }
  img.onerror = () => { resolve(false); }
  img.src = url
})

// 依次尝试 sendBeacon → fetch keepalive → img 像素；4xx 表示契约或白名单问题，不重试
export const createTransport = ({ reportHost, enableImgFallback }: TransportOptions): SendBatch => {
  const pixelUrl = `${reportHost.replace(/\/+$/, '')}.gif`
  return async (events) => {
    const body = JSON.stringify({ events })
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(reportHost, body)) return 'sent'

    if (typeof fetch === 'function') {
      try {
        const res = await fetch(reportHost, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
        if (res.ok) return 'sent'
        if (res.status >= 400 && res.status < 500) {
          log.error('上报被服务端拒绝', res.status)
          return 'drop'
        }
        log.warn('上报服务端异常', res.status)
      } catch (error) {
        log.warn('fetch 上报失败', error)
      }
    }

    if (!enableImgFallback) return 'retry'
    const results = await Promise.all(events.map(async (event) => await loadPixel(`${pixelUrl}?d=${toBase64Url(JSON.stringify(event))}`)))
    return results.every(Boolean) ? 'sent' : 'retry'
  }
}
