import { useCallback, useState } from 'react'
import { BOTS_MODES, type BotsMode } from '@fanta/shared'
import { presetRange, type Preset, type TimeRange } from '../lib/time'

export interface Filters extends TimeRange {
  app: string
  preset: Preset
  bots: BotsMode
}

const PRESET_IDS: Preset[] = ['today', '24h', '7d', '30d', 'custom']

// 筛选状态保存在 location.search，刷新页面不丢失；路由用 hash
export const parseFilters = (search: string, now = Date.now()): Filters => {
  const params = new URLSearchParams(search)
  const preset = PRESET_IDS.find((p) => p === params.get('preset')) ?? '7d'
  const bots = BOTS_MODES.find((b) => b === params.get('bots')) ?? 'exclude'
  const from = Number(params.get('from'))
  const to = Number(params.get('to'))
  const range = preset === 'custom' && from > 0 && to > from ? { from, to } : presetRange(preset === 'custom' ? '7d' : preset, now)
  return { app: params.get('app') ?? '', preset: preset === 'custom' && !(from > 0 && to > from) ? '7d' : preset, bots, ...range }
}

export const serializeFilters = (filters: Filters): string => {
  const params = new URLSearchParams({ app: filters.app, preset: filters.preset, bots: filters.bots })
  if (filters.preset === 'custom') {
    params.set('from', String(filters.from))
    params.set('to', String(filters.to))
  }
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
      window.history.replaceState(null, '', `${serializeFilters(next)}${window.location.hash}`)
      return next
    })
  }, [])

  return { filters, update }
}
