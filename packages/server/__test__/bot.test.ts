import { describe, it, expect } from 'vitest'
import { classifyBot } from '../src/bot.js'
import { makeEvent } from './helpers.js'

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

describe('classifyBot', () => {
  it('webdriver 信号优先级最高', () => {
    expect(classifyBot(makeEvent({ userAgent: GOOGLEBOT, isBot: true, isWebdriver: true }))).toBe('webdriver')
  })

  it('服务端 UA 库命中返回 ua，即使 SDK 未标记', () => {
    expect(classifyBot(makeEvent({ userAgent: GOOGLEBOT, isBot: false }))).toBe('ua')
  })

  it('仅 SDK 标记且 UA 库未命中返回 sdk', () => {
    expect(classifyBot(makeEvent({ userAgent: CHROME, isBot: true }))).toBe('sdk')
  })

  it('普通浏览器返回 none', () => {
    expect(classifyBot(makeEvent({ userAgent: CHROME }))).toBe('none')
  })

  it('缺少 isWebdriver 字段按 false 处理', () => {
    const event = makeEvent({ userAgent: CHROME })
    delete (event as { isWebdriver?: boolean }).isWebdriver
    expect(classifyBot(event)).toBe('none')
  })
})
