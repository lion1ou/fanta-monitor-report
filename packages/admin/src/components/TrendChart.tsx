import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Granularity } from '@fanta/shared'
import { formatBucket, formatDateTime } from '../lib/time'
import { formatNumber } from '../lib/format'
import { Empty } from './Primitives'

export interface SeriesSpec {
  key: string
  name: string
  color: string
  format?: (value: number) => string
}

interface Props {
  data: Array<Record<string, unknown>>
  series: SeriesSpec[]
  granularity: Granularity
  kind?: 'line' | 'bar'
  height?: number
  yFormat?: (value: number) => string
}

const axisStyle = { fontSize: 11, fill: 'oklch(60% 0 0)' }
const gridStroke = 'oklch(93% 0 0)'

// 统一的时间序列图：x 轴为 bucket，多条序列共用一个 y 轴
export const TrendChart = ({ data, series, granularity, kind = 'line', height = 240, yFormat = formatNumber }: Props) => {
  const hasValue = data.some((row) => series.some((s) => typeof row[s.key] === 'number'))
  if (data.length === 0 || !hasValue) return <Empty />

  const tooltipFormatter = (value: unknown, name: unknown) => {
    const spec = series.find((s) => s.name === name)
    const num = typeof value === 'number' ? value : null
    return [num === null ? '—' : (spec?.format ?? yFormat)(num), String(name)]
  }
  const shared = {
    data,
    margin: { top: 8, right: 8, bottom: 0, left: -8 }
  }
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={gridStroke} />
      <XAxis dataKey="bucket" tickFormatter={(v: string) => formatBucket(v, granularity)} tick={axisStyle} axisLine={false} tickLine={false} minTickGap={24} />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => yFormat(v)} width={56} allowDecimals={false} />
      <Tooltip
        formatter={tooltipFormatter}
        labelFormatter={(label) => formatDateTime(String(label)).slice(0, granularity === 'hour' ? 16 : 10)}
        contentStyle={{ fontSize: 12, borderRadius: 4, border: '1px solid oklch(91% 0 0)', boxShadow: 'none' }}
        cursor={{ stroke: gridStroke }}
      />
    </>
  )
  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'bar'
          ? (
            <BarChart {...shared}>
              {axes}
              {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false} />)}
            </BarChart>
            )
          : (
            <LineChart {...shared}>
              {axes}
              {/* 线性插值 + 常显小圆点：避免平滑曲线在 0 基线上过冲，也保证孤立采样点（前后为空桶）可见 */}
              {series.map((s) => <Line key={s.key} type="linear" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={1.75} dot={{ r: 2.5, strokeWidth: 0, fill: s.color }} activeDot={{ r: 4 }} connectNulls={false} isAnimationActive={false} />)}
            </LineChart>
            )}
      </ResponsiveContainer>
    </div>
  )
}

export const ChartLegend = ({ series }: { series: SeriesSpec[] }) => (
  <div className="legend">
    {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.name}</span>)}
  </div>
)

export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)']
