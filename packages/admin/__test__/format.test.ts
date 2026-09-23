import { describe, it, expect } from 'vitest'
import { formatNumber, formatPercent, formatDelta, formatMs, formatMetric, formatRegion, formatDuration } from '../src/lib/format'

describe('format', () => {
  it('formatNumber 千分位', () => {
    expect(formatNumber(12345)).toBe('12,345')
    expect(formatNumber(0)).toBe('0')
  })

  it('formatPercent 一位小数', () => {
    expect(formatPercent(0.1234)).toBe('12.3%')
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('formatDuration 秒转分秒', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(45.4)).toBe('45s')
    expect(formatDuration(1200)).toBe('20m 00s')
    expect(formatDuration(65)).toBe('1m 05s')
  })

  it('formatDelta 环比', () => {
    expect(formatDelta(120, 100)).toEqual({ text: '+20.0%', direction: 'up' })
    expect(formatDelta(80, 100)).toEqual({ text: '-20.0%', direction: 'down' })
    expect(formatDelta(5, 0)).toEqual({ text: '新增', direction: 'up' })
    expect(formatDelta(0, 0)).toEqual({ text: '—', direction: 'flat' })
  })

  it('formatMs 毫秒与秒切换', () => {
    expect(formatMs(320)).toBe('320 ms')
    expect(formatMs(2500)).toBe('2.50 s')
    expect(formatMs(null)).toBe('—')
  })

  it('formatMetric 按指标类型选择格式', () => {
    expect(formatMetric('cls', 0.0512)).toBe('0.051')
    expect(formatMetric('lcp', 2500)).toBe('2.50 s')
    expect(formatMetric('inp', null)).toBe('—')
  })

  it('formatRegion 省市、直辖市去重、仅国家与未知', () => {
    expect(formatRegion({ country: '中国', province: '广东省', city: '深圳市' })).toBe('广东省 · 深圳市')
    expect(formatRegion({ country: '中国', province: '北京市', city: '北京市' })).toBe('北京市')
    expect(formatRegion({ country: 'United States', province: 'California', city: '' })).toBe('California')
    expect(formatRegion({ country: '内网', province: '', city: '' })).toBe('内网')
    expect(formatRegion({ country: '', province: '', city: '' })).toBe('未知')
  })
})
