import { useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import type { GlobalStats, StatsKpi } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatDelta, formatDuration, formatNumber, formatPercent } from '../lib/format'
import { hrefOf } from '../state/route'
import { Card, ErrorState, Segmented, Skeleton } from '../components/Primitives'
import { ChartLegend, TrendChart, type SeriesSpec } from '../components/TrendChart'
import { PageHead } from '../components/PageHead'

type Metric = 'pv' | 'uv'
const METRICS: Array<{ id: Metric, label: string }> = [{ id: 'pv', label: 'PV' }, { id: 'uv', label: 'UV' }]

// 每个 app 一种颜色，超出后循环
export const APP_COLORS = [
  'oklch(55% 0.16 250)', 'oklch(60% 0.14 25)', 'oklch(60% 0.15 150)', 'oklch(65% 0.15 75)',
  'oklch(55% 0.16 300)', 'oklch(60% 0.12 200)', 'oklch(50% 0.1 0)', 'oklch(70% 0.1 120)'
]
export const appColor = (index: number) => APP_COLORS[index % APP_COLORS.length]

// 把「每 app 一条序列」透视成「每 bucket 一行、每 app 一列」供折线图使用
export const pivotSeries = (apps: GlobalStats['apps'], metric: Metric): Array<Record<string, unknown>> => {
  const rows = new Map<string, Record<string, unknown>>()
  for (const item of apps) {
    for (const point of item.series) {
      const row = rows.get(point.bucket) ?? { bucket: point.bucket }
      row[item.app] = point[metric]
      rows.set(point.bucket, row)
    }
  }
  return [...rows.values()].sort((a, b) => String(a.bucket).localeCompare(String(b.bucket)))
}

export const Global = ({ filters, reloadKey, onFilter }: PageProps) => {
  const [metric, setMetric] = useState<Metric>('pv')
  const { data, error } = useStats<GlobalStats>('/global', { from: filters.from, to: filters.to, bots: filters.bots, tagged: filters.tagged }, reloadKey)
  const apps = data?.apps ?? []
  const series: SeriesSpec[] = apps.map((item, i) => ({ key: item.app, name: item.app, color: appColor(i) }))
  const chartData = useMemo(() => pivotSeries(apps, metric), [apps, metric])
  const total = apps.reduce((sum, item) => sum + item.current[metric], 0)

  const openApp = (app: string) => {
    onFilter({ app })
    window.location.hash = hrefOf('overview')
  }

  return (
    <>
      <PageHead title="全局总览" filters={{ ...filters, app: '' }} extra={data && <span> · {apps.length} 个应用 · 按{data.granularity === 'hour' ? '小时' : '天'}分桶</span>} />
      {error && <ErrorState message={error} />}

      <div className="grid grid-3">
        {data
          ? apps.map((item, i) => <AppCard key={item.app} item={item} color={appColor(i)} metric={metric} onOpen={() => { openApp(item.app); }} />)
          : [0, 1, 2].map((i) => <section key={i} className="card kpi"><Skeleton height={12} width={96} /><Skeleton height={30} width={140} /><Skeleton height={12} width={200} /></section>)}
        {data && apps.length === 0 && <Card><span className="muted">尚无应用上报数据</span></Card>}
      </div>

      <Card
        title={`${metric.toUpperCase()} 趋势`}
        hint={`区间合计 ${formatNumber(total)}，每条折线为一个应用`}
        action={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ChartLegend series={series} />
            <Segmented<Metric> label="指标" options={METRICS} value={metric} onChange={setMetric} />
          </div>
        )}
      >
        {data ? <TrendChart data={chartData} series={series} granularity={data.granularity} height={320} /> : <Skeleton height={320} />}
      </Card>
    </>
  )
}

const AppCard = ({ item, color, metric, onOpen }: { item: GlobalStats['apps'][number], color: string, metric: Metric, onOpen: () => void }) => {
  const { app, current, previous }: { app: string, current: StatsKpi, previous: StatsKpi } = item
  const pv = formatDelta(current.pv, previous.pv)
  const uv = formatDelta(current.uv, previous.uv)
  return (
    <section className="card kpi app-card" aria-label={app} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}>
      <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i className="dot" style={{ background: color }} />{app}</h2>
      <div className="app-card-main">
        <div>
          <div className="kpi-value num">{formatNumber(current.pv)}</div>
          <div className="kpi-foot"><span className={`delta ${pv.direction}`}>{pv.text}</span><span>PV</span></div>
        </div>
        <div>
          <div className="kpi-value num" style={{ fontSize: 20 }}>{formatNumber(current.uv)}</div>
          <div className="kpi-foot"><span className={`delta ${uv.direction}`}>{uv.text}</span><span>UV</span></div>
        </div>
        <div className="sparkline" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={item.series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <Line type="linear" dataKey={metric} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="app-card-meta faint">
        <span>会话 {formatNumber(current.sessions)}</span>
        <span>跳出率 {formatPercent(current.bounceRate)}</span>
        <span>时长 {formatDuration(current.avgVisitDuration)}</span>
        {current.excludedVisitors > 0 && <span>已排除 {current.excludedVisitors} 访客</span>}
      </div>
    </section>
  )
}
