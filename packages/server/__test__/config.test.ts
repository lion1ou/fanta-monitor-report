import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('缺少必填变量时抛出并列出变量名', () => {
    expect(() => loadConfig({})).toThrow('DATABASE_URL, ALLOWED_APPS')
  })

  it('ALLOWED_APPS 为空字符串时抛出', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x', ALLOWED_APPS: ' , ' })).toThrow('ALLOWED_APPS')
  })

  it('解析白名单并填充默认值', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x', ALLOWED_APPS: 'a, b ,c' })
    expect([...config.allowedApps]).toEqual(['a', 'b', 'c'])
    expect(config).toMatchObject({ port: 5001, corsOrigin: '*', trustProxy: false, logLevel: 'info' })
  })

  it('读取可选变量', () => {
    const config = loadConfig({ DATABASE_URL: 'postgres://x', ALLOWED_APPS: 'a', PORT: '8080', TRUST_PROXY: 'true', CORS_ORIGIN: 'https://a.com', LOG_LEVEL: 'warn' })
    expect(config).toMatchObject({ port: 8080, trustProxy: true, corsOrigin: 'https://a.com', logLevel: 'warn' })
  })
})
