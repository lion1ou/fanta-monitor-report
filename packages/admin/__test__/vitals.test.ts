import { describe, it, expect } from 'vitest'
import { rateMetric } from '../src/lib/vitals'

describe('rateMetric', () => {
  it('按 Web Vitals 阈值评级', () => {
    expect(rateMetric('lcp', 2400)).toBe('good')
    expect(rateMetric('lcp', 2500)).toBe('good')
    expect(rateMetric('lcp', 3000)).toBe('needsImprovement')
    expect(rateMetric('lcp', 4001)).toBe('poor')
    expect(rateMetric('cls', 0.3)).toBe('poor')
  })

  it('无阈值的指标与空值不评级', () => {
    expect(rateMetric('load', 9999)).toBe('none')
    expect(rateMetric('lcp', null)).toBe('none')
  })
})
