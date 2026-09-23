import { BOTS_MODES, type BotsMode } from '@fanta/shared'
import { PRESETS, toInputValue, type Preset } from '../lib/time'
import type { Filters } from '../state/filters'
import { Segmented } from './Primitives'

const BOTS_LABELS: Record<BotsMode, string> = { exclude: '排除爬虫', include: '包含爬虫', only: '仅爬虫' }
const BOTS_OPTIONS = BOTS_MODES.map((id) => ({ id, label: BOTS_LABELS[id] }))

export const FilterBar = ({ filters, apps, onChange, onRefresh }: {
  filters: Filters
  apps: string[]
  onChange: (patch: Partial<Filters>) => void
  onRefresh: () => void
}) => {
  const parseInput = (value: string) => new Date(value).getTime()
  return (
    <div className="filterbar">
      <label className="filter-label" htmlFor="app-select">应用</label>
      <select id="app-select" value={filters.app} onChange={(e) => { onChange({ app: e.target.value }); }}>
        {apps.length === 0 && <option value="">暂无数据</option>}
        {apps.map((app) => <option key={app} value={app}>{app}</option>)}
      </select>

      <Segmented<Preset> label="时间范围" options={PRESETS} value={filters.preset} onChange={(preset) => { onChange({ preset }); }} />
      {filters.preset === 'custom' && (
        <>
          <input type="datetime-local" aria-label="开始时间" value={toInputValue(filters.from)} max={toInputValue(filters.to)}
            onChange={(e) => { const from = parseInput(e.target.value); if (from < filters.to) onChange({ from, to: filters.to }) }} />
          <span className="faint">—</span>
          <input type="datetime-local" aria-label="结束时间" value={toInputValue(filters.to)} min={toInputValue(filters.from)}
            onChange={(e) => { const to = parseInput(e.target.value); if (to > filters.from) onChange({ from: filters.from, to }) }} />
        </>
      )}

      <Segmented<BotsMode> label="爬虫流量" options={BOTS_OPTIONS} value={filters.bots} onChange={(bots) => { onChange({ bots }); }} />
      <span className="spacer" />
      <button type="button" className="btn" onClick={onRefresh}>刷新</button>
    </div>
  )
}
