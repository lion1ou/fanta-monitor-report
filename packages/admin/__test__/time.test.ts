import { describe, it, expect } from 'vitest'
import { presetRange, granularityOf, startOfDay, formatBucket } from '../src/lib/time'

const NOW = new Date(2026, 8, 22, 15, 30).getTime() // 本地时间 2026-09-22 15:30
const DAY = 24 * 60 * 60 * 1000

describe('presetRange', () => {
  it('7d 从 6 天前的零点到现在，按天分桶', () => {
    const range = presetRange('7d', NOW)
    expect(range.from).toBe(startOfDay(NOW) - 6 * DAY)
    expect(range.to).toBe(NOW)
    expect(granularityOf(range)).toBe('day')
  })

  it('24h 为滚动 24 小时，按小时分桶', () => {
    const range = presetRange('24h', NOW)
    expect(range.from).toBe(NOW - DAY)
    expect(granularityOf(range)).toBe('hour')
  })

  it('today 从今天零点开始', () => {
    expect(presetRange('today', NOW).from).toBe(new Date(2026, 8, 22).getTime())
  })

  it('30d 从 29 天前的零点开始', () => {
    expect(presetRange('30d', NOW).from).toBe(startOfDay(NOW) - 29 * DAY)
  })
})

describe('granularityOf', () => {
  it('刚好 48 小时按小时，超过按天', () => {
    expect(granularityOf({ from: 0, to: 48 * 60 * 60 * 1000 })).toBe('hour')
    expect(granularityOf({ from: 0, to: 3 * DAY })).toBe('day')
  })
})

describe('formatBucket', () => {
  it('按粒度输出短标签', () => {
    const iso = new Date(2026, 8, 22, 9).toISOString()
    expect(formatBucket(iso, 'hour')).toBe('09-22 09:00')
    expect(formatBucket(iso, 'day')).toBe('09-22')
  })
})
