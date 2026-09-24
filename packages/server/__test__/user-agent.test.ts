import { describe, expect, it } from 'vitest'
import * as devices from '../src/stats/devices.js'

describe('classifyUserAgent', () => {
  it('提供 UA 基础分类函数', () => {
    const classify = (devices as unknown as { classifyUserAgent?: unknown }).classifyUserAgent
    expect(typeof classify).toBe('function')
  })

  it('区分爬虫、WebView、脚本客户端、浏览器与其他 UA', () => {
    const classify = devices.classifyUserAgent
    expect(classify('Mozilla/5.0 HeadlessChrome/120.0', 'Chrome', false)).toBe('bot')
    expect(classify('Mozilla/5.0 Electron/31.0 Chrome/126.0', 'Chrome', false)).toBe('webview')
    expect(classify('curl/8.7.1', '', false)).toBe('script')
    expect(classify('Mozilla/5.0 Chrome/126.0', 'Chrome', false)).toBe('browser')
    expect(classify('custom-client', '', false)).toBe('other')
  })
})
