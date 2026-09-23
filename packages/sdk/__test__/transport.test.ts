import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTransport, toBase64Url } from '../src/common/transport'
import { makeEvent } from './helpers'

const reportHost = 'http://localhost:5001/v1/track'

class FakeImage {
  static urls: string[] = []
  static shouldFail = false
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src (url: string) {
    FakeImage.urls.push(url)
    setTimeout(() => { (FakeImage.shouldFail ? this.onerror : this.onload)?.() }, 0)
  }
}

describe('createTransport', () => {
  const sendBeacon = vi.fn()
  const fetchMock = vi.fn()

  beforeEach(() => {
    FakeImage.urls = []
    FakeImage.shouldFail = false
    Object.defineProperty(window.navigator, 'sendBeacon', { value: sendBeacon, configurable: true })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('Image', FakeImage)
  })

  it('sendBeacon 成功时返回 sent 且不调用 fetch', async () => {
    sendBeacon.mockReturnValue(true)
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('sent')
    expect(sendBeacon).toHaveBeenCalledWith(reportHost, JSON.stringify({ events: [makeEvent()] }))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sendBeacon 失败后 fetch 2xx 返回 sent，请求为 text/plain 的 POST', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValue({ ok: true, status: 200 })
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('sent')
    expect(fetchMock).toHaveBeenCalledWith(reportHost, expect.objectContaining({
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }
    }))
  })

  it('fetch 返回 4xx 时返回 drop 且不走像素', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('drop')
    expect(FakeImage.urls).toHaveLength(0)
  })

  it('fetch 异常时逐条走像素，URL 指向 .gif 并携带 base64url 的 d 参数', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockRejectedValue(new Error('network'))
    const events = [makeEvent({ trackId: 'a' }), makeEvent({ trackId: 'b' })]
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send(events)).toBe('sent')
    expect(FakeImage.urls).toEqual([
      `${reportHost}.gif?d=${toBase64Url(JSON.stringify(events[0]))}`,
      `${reportHost}.gif?d=${toBase64Url(JSON.stringify(events[1]))}`
    ])
  })

  it('像素加载失败返回 retry', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    FakeImage.shouldFail = true
    const send = createTransport({ reportHost, enableImgFallback: true })
    expect(await send([makeEvent()])).toBe('retry')
  })

  it('关闭像素降级且 fetch 异常时直接返回 retry', async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockRejectedValue(new Error('network'))
    const send = createTransport({ reportHost, enableImgFallback: false })
    expect(await send([makeEvent()])).toBe('retry')
    expect(FakeImage.urls).toHaveLength(0)
  })
})

describe('toBase64Url', () => {
  it('输出不含 + / = 且能被 Node base64url 解码', () => {
    const text = JSON.stringify({ 中文: 'ok', n: 1 })
    const encoded = toBase64Url(text)
    expect(encoded).not.toMatch(/[+/=]/)
    expect(Buffer.from(encoded, 'base64url').toString('utf8')).toBe(text)
  })
})
