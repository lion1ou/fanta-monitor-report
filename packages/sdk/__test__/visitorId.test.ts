// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://jz.lion1ou.tech/" }
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cookieDomainOf, resolveVisitorId, VISITOR_COOKIE } from '../src/common/visitorId'
import { UUID_LOCAL_KEY } from '../src/common/constant'

const clearCookies = () => {
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim()
    if (!name) return
    document.cookie = `${name}=; Max-Age=0; Path=/`
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.lion1ou.tech`
  })
}

// 只覆盖 hostname / protocol，cookie 写入仍走 jsdom 的 document.cookie 校验
const setHost = (hostname: string, protocol = 'https:') => {
  vi.stubGlobal('location', { hostname, protocol })
}

describe('cookieDomainOf', () => {
  it('取主机名末两段作为注册域', () => {
    expect(cookieDomainOf('jz.lion1ou.tech')).toBe('.lion1ou.tech')
    expect(cookieDomainOf('www.chuyunt.com')).toBe('.chuyunt.com')
    expect(cookieDomainOf('lion1ou.tech')).toBe('.lion1ou.tech')
  })

  it('localhost、IP、单段主机名不写 cookie', () => {
    expect(cookieDomainOf('localhost')).toBeNull()
    expect(cookieDomainOf('127.0.0.1')).toBeNull()
    expect(cookieDomainOf('192.168.1.10')).toBeNull()
    expect(cookieDomainOf('intranet')).toBeNull()
  })
})

describe('resolveVisitorId', () => {
  beforeEach(() => {
    clearCookies()
    window.localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('cookie 已有 id 时优先使用并同步到 localStorage', () => {
    document.cookie = `${VISITOR_COOKIE}=shared-id; Path=/`
    window.localStorage.setItem(UUID_LOCAL_KEY, JSON.stringify('local-id'))
    expect(resolveVisitorId()).toBe('shared-id')
    expect(JSON.parse(window.localStorage.getItem(UUID_LOCAL_KEY) ?? '')).toBe('shared-id')
  })

  it('无 cookie 时沿用 localStorage 中的旧 id，并写入同主域 cookie', () => {
    window.localStorage.setItem(UUID_LOCAL_KEY, JSON.stringify('local-id'))
    const setter = vi.spyOn(document, 'cookie', 'set')
    expect(resolveVisitorId()).toBe('local-id')
    expect(setter.mock.calls[0][0]).toContain(`${VISITOR_COOKIE}=local-id; Domain=.lion1ou.tech; Path=/; Max-Age=63072000; SameSite=Lax; Secure`)
    expect(document.cookie).toContain(`${VISITOR_COOKIE}=local-id`)
  })

  it('两者都没有时生成新 id，之后调用保持稳定', () => {
    const first = resolveVisitorId()
    expect(first).toMatch(/^[0-9a-f-]+$/)
    expect(resolveVisitorId()).toBe(first)
  })

  it('cookieDomain 配置覆盖自动推导', () => {
    const setter = vi.spyOn(document, 'cookie', 'set')
    resolveVisitorId('.example.org')
    expect(setter.mock.calls[0][0]).toContain('Domain=.example.org')
  })

  it('localhost 下只写 localStorage，不写 cookie', () => {
    setHost('localhost', 'http:')
    const setter = vi.spyOn(document, 'cookie', 'set')
    const id = resolveVisitorId()
    expect(setter).not.toHaveBeenCalled()
    expect(JSON.parse(window.localStorage.getItem(UUID_LOCAL_KEY) ?? '')).toBe(id)
  })

  it('http 下不带 Secure', () => {
    setHost('a.lion1ou.tech', 'http:')
    const setter = vi.spyOn(document, 'cookie', 'set')
    resolveVisitorId()
    expect(setter.mock.calls[0][0]).toContain('Domain=.lion1ou.tech')
    expect(setter.mock.calls[0][0]).not.toContain('Secure')
  })
})
