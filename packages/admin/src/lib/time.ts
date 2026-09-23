import type { Granularity } from '@fanta/shared'

export type Preset = 'today' | '24h' | '7d' | '30d' | 'custom'
export interface TimeRange { from: number, to: number }

const DAY = 24 * 60 * 60 * 1000
const HOUR_GRANULARITY_MAX_MS = 48 * 60 * 60 * 1000

export const PRESETS: Array<{ id: Preset, label: string }> = [
  { id: 'today', label: '今天' },
  { id: '24h', label: '24 小时' },
  { id: '7d', label: '7 天' },
  { id: '30d', label: '30 天' },
  { id: 'custom', label: '自定义' }
]

export const startOfDay = (ms: number): number => {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// 按天的预设从整天零点开始，保证日桶完整；24h 为滚动窗口
export const presetRange = (preset: Exclude<Preset, 'custom'>, now = Date.now()): TimeRange => {
  switch (preset) {
    case 'today': return { from: startOfDay(now), to: now }
    case '24h': return { from: now - DAY, to: now }
    case '7d': return { from: startOfDay(now) - 6 * DAY, to: now }
    case '30d': return { from: startOfDay(now) - 29 * DAY, to: now }
  }
}

// 与服务端 scope.ts 保持一致
export const granularityOf = (range: TimeRange): Granularity =>
  range.to - range.from <= HOUR_GRANULARITY_MAX_MS ? 'hour' : 'day'

const pad = (n: number) => String(n).padStart(2, '0')

export const formatBucket = (iso: string, granularity: Granularity): string => {
  const d = new Date(iso)
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return granularity === 'hour' ? `${md} ${pad(d.getHours())}:00` : md
}

export const formatDateTime = (iso: string | number): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// datetime-local 输入框的值格式
export const toInputValue = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const describeRange = (range: TimeRange): string => `${formatDateTime(range.from).slice(0, 16)} 至 ${formatDateTime(range.to).slice(0, 16)}`
