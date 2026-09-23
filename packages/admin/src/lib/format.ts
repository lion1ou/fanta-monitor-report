import type { GeoRegion, VitalMetric } from '@fanta/shared'

const numberFormat = new Intl.NumberFormat('en-US')

export const formatNumber = (value: number): string => numberFormat.format(value)

export const formatPercent = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`

export type DeltaDirection = 'up' | 'down' | 'flat'

export const formatDelta = (current: number, previous: number): { text: string, direction: DeltaDirection } => {
  if (previous === 0) return current > 0 ? { text: '新增', direction: 'up' } : { text: '—', direction: 'flat' }
  const ratio = (current - previous) / previous
  const sign = ratio > 0 ? '+' : ''
  return { text: `${sign}${(ratio * 100).toFixed(1)}%`, direction: ratio > 0 ? 'up' : ratio < 0 ? 'down' : 'flat' }
}

export const formatMs = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${Math.round(value)} ms`
}

export const formatMetric = (metric: VitalMetric, value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—'
  return metric === 'cls' ? value.toFixed(3) : formatMs(value)
}

export const shortId = (value: string, keep = 8): string => value.length > keep ? `${value.slice(0, keep)}…` : value

// 地域显示：优先「省 · 市」（直辖市省市同名只显示一次），只有国家（海外/内网）时显示国家，三者皆空为未知
export const formatRegion = (geo: GeoRegion): string => {
  const parts = geo.province === geo.city ? [geo.province] : [geo.province, geo.city]
  return parts.filter(Boolean).join(' · ') || geo.country || '未知'
}
