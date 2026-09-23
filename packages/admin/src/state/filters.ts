import { useCallback, useState } from 'react'
import { BOTS_MODES, DIMENSION_KEYS, TAGGED_MODES, type BotsMode, type DimensionFilters, type DimensionKey, type TaggedMode } from '@fanta/shared'
import { presetRange, type Preset, type TimeRange } from '../lib/time'

export interface Filters extends TimeRange, DimensionFilters {
  app: string
  preset: Preset
  bots: BotsMode
  tagged: TaggedMode
}

const PRESET_IDS: Preset[] = ['today', '24h', '7d', '30d', 'custom']

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  path: '路径',
  referrerHost: '来源',
  browser: '浏览器',
  os: '操作系统',
  deviceType: '设备类型',
  country: '国家',
  province: '省份',
  city: '城市',
  language: '语言'
}

// 当前生效的维度下钻条件（有值的键）
export const activeDimensions = (filters: DimensionFilters): Array<{ key: DimensionKey, value: string }> =>
  DIMENSION_KEYS.flatMap((key) => {
    const value = filters[key]
    return value ? [{ key, value }] : []
  })

// 筛选状态保存在 location.search，刷新页面不丢失；路由用 hash
export const parseFilters = (search: string, now = Date.now()): Filters => {
  const params = new URLSearchParams(search)
  const preset = PRESET_IDS.find((p) => p === params.get('preset')) ?? '7d'
  const bots = BOTS_MODES.find((b) => b === params.get('bots')) ?? 'exclude'
  const tagged = TAGGED_MODES.find((t) => t === params.get('tagged')) ?? 'exclude'
  const from = Number(params.get('from'))
  const to = Number(params.get('to'))
  const range = preset === 'custom' && from > 0 && to > from ? { from, to } : presetRange(preset === 'custom' ? '7d' : preset, now)
  const dimensions: DimensionFilters = {}
  for (const key of DIMENSION_KEYS) {
    const value = params.get(key)
    if (value) dimensions[key] = value
  }
  return { app: params.get('app') ?? '', preset: preset === 'custom' && !(from > 0 && to > from) ? '7d' : preset, bots, tagged, ...range, ...dimensions }
}

export const serializeFilters = (filters: Filters): string => {
  const params = new URLSearchParams({ app: filters.app, preset: filters.preset, bots: filters.bots, tagged: filters.tagged })
  if (filters.preset === 'custom') {
    params.set('from', String(filters.from))
    params.set('to', String(filters.to))
  }
  for (const { key, value } of activeDimensions(filters)) params.set(key, value)
  return `?${params.toString()}`
}

export const useFilters = () => {
  const [filters, setFilters] = useState<Filters>(() => parseFilters(window.location.search))

  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => {
      let next: Filters = { ...prev, ...patch }
      // 切换预设时按当前时间重算区间；刷新时也走这里让「现在」前移
      if (next.preset !== 'custom' && (patch.preset !== undefined || patch.to === undefined)) {
        next = { ...next, ...presetRange(next.preset) }
      }
      // 切换应用时维度下钻不再有意义，一并清空
      if (patch.app !== undefined && patch.app !== prev.app) {
        next = { ...next, ...Object.fromEntries(DIMENSION_KEYS.map((key) => [key, undefined])) }
      }
      window.history.replaceState(null, '', `${serializeFilters(next)}${window.location.hash}`)
      return next
    })
  }, [])

  return { filters, update }
}
