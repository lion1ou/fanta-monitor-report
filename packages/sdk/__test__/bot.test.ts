import { describe, it, expect, afterEach } from 'vitest'
import { getBaseInfo } from '../src/h5/h5BaseInfo'

const setWebdriver = (value: boolean | undefined) => {
  Object.defineProperty(window.navigator, 'webdriver', { value, configurable: true })
}

describe('getBaseInfo 无头浏览器信号', () => {
  afterEach(() => { setWebdriver(undefined) })

  it('navigator.webdriver 为 true 时标记 isWebdriver 与 isBot', () => {
    setWebdriver(true)
    const info = getBaseInfo()
    expect(info.isWebdriver).toBe(true)
    expect(info.isBot).toBe(true)
  })

  it('普通浏览器两者都为 false', () => {
    setWebdriver(false)
    const info = getBaseInfo()
    expect(info.isWebdriver).toBe(false)
    expect(info.isBot).toBe(false)
  })
})
