import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { defaultGeoXdbDir } from '../src/config.js'
import { EMPTY_GEO, XDB_FILES, createGeoResolver, loadGeoResolver, parseRegion, type RegionSearcher } from '../src/geo.js'

// 真实 xdb 需先执行 npm run geo:download；缺失时本组用例跳过并在输出中可见
const xdbDir = process.env.GEO_XDB_DIR ?? defaultGeoXdbDir()
const hasXdb = existsSync(join(xdbDir, XDB_FILES.v4)) && existsSync(join(xdbDir, XDB_FILES.v6))

describe.skipIf(!hasXdb)('loadGeoResolver（真实 xdb）', () => {
  it('国内 IPv4/IPv6 解析到国家与省份，回环与保留地址为内网', async () => {
    const resolve = loadGeoResolver(xdbDir)
    expect(resolve).not.toBeNull()
    expect(await resolve!('114.114.114.114')).toMatchObject({ country: '中国', province: '江苏省' })
    expect(await resolve!('2409:8a00:1::1')).toMatchObject({ country: '中国' })
    expect(await resolve!('8.8.8.8')).toMatchObject({ country: 'United States' })
    expect(await resolve!('127.0.0.1')).toEqual({ country: '内网', province: '', city: '' })
    expect(await resolve!('::ffff:10.0.0.1')).toEqual({ country: '内网', province: '', city: '' })
  })

  it('目录缺少 xdb 时返回 null', () => {
    expect(loadGeoResolver('/nonexistent')).toBeNull()
  })
})

describe('parseRegion', () => {
  it('解析 国家|省|市|ISP|国家码，0 视为空', () => {
    expect(parseRegion('中国|广东省|深圳市|阿里|CN')).toEqual({ country: '中国', province: '广东省', city: '深圳市' })
    expect(parseRegion('United States|California|0|Google LLC|US')).toEqual({ country: 'United States', province: 'California', city: '' })
    expect(parseRegion('Australia|0|0|0|AU')).toEqual({ country: 'Australia', province: '', city: '' })
  })

  it('保留地址归为内网，空串为未知', () => {
    expect(parseRegion('Reserved|Reserved|Reserved|0|0')).toEqual({ country: '内网', province: '', city: '' })
    expect(parseRegion('')).toEqual(EMPTY_GEO)
  })
})

const fakeSearcher = (region: string): RegionSearcher => ({ search: vi.fn(async () => region) })

describe('createGeoResolver', () => {
  it('IPv4 走 v4 库，IPv6 走 v6 库', async () => {
    const v4 = fakeSearcher('中国|北京市|北京市|移动|CN')
    const v6 = fakeSearcher('中国|上海市|上海市|电信|CN')
    const resolve = createGeoResolver(v4, v6)
    expect(await resolve('39.156.66.10')).toEqual({ country: '中国', province: '北京市', city: '北京市' })
    expect(await resolve('2409:8a00:1::1')).toEqual({ country: '中国', province: '上海市', city: '上海市' })
    expect(v4.search).toHaveBeenCalledWith('39.156.66.10')
    expect(v6.search).toHaveBeenCalledWith('2409:8a00:1::1')
  })

  it('IPv4-mapped IPv6 剥离前缀后走 v4 库', async () => {
    const v4 = fakeSearcher('中国|广东省|深圳市|阿里|CN')
    const v6 = fakeSearcher('')
    await createGeoResolver(v4, v6)('::ffff:120.24.78.68')
    expect(v4.search).toHaveBeenCalledWith('120.24.78.68')
    expect(v6.search).not.toHaveBeenCalled()
  })

  it('非法 IP、空串与查询异常都返回未知，不抛错', async () => {
    const boom: RegionSearcher = { search: vi.fn(async () => { throw new Error('bad xdb') }) }
    const warn = vi.fn()
    const resolve = createGeoResolver(boom, boom, warn)
    expect(await resolve('not-an-ip')).toEqual(EMPTY_GEO)
    expect(await resolve('')).toEqual(EMPTY_GEO)
    expect(await resolve('1.2.3.4')).toEqual(EMPTY_GEO)
    expect(boom.search).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1.2.3.4'))
  })

  it('本机回环地址按内网处理', async () => {
    const v4 = fakeSearcher('Reserved|Reserved|Reserved|0|0')
    const v6 = fakeSearcher('')
    const resolve = createGeoResolver(v4, v6)
    expect(await resolve('127.0.0.1')).toEqual({ country: '内网', province: '', city: '' })
    expect(await resolve('::1')).toEqual({ country: '内网', province: '', city: '' })
  })
})
