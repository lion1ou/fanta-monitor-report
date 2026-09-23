import { VITAL_METRICS, VITAL_THRESHOLDS, type MetricSummary, type PerformanceStats, type VitalMetric } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatMetric, formatMs, formatNumber, formatPercent } from '../lib/format'
import { METRIC_LABELS, RATING_LABELS, rateMetric } from '../lib/vitals'
import { Card, ErrorState, Skeleton } from '../components/Primitives'
import { CHART_COLORS, ChartLegend, TrendChart } from '../components/TrendChart'
import { DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

const TREND = [
  { key: 'lcp', name: 'LCP p75', color: CHART_COLORS[0], format: formatMs },
  { key: 'fcp', name: 'FCP p75', color: CHART_COLORS[1], format: formatMs },
  { key: 'inp', name: 'INP p75', color: CHART_COLORS[2], format: formatMs }
]

export const Performance = ({ filters, reloadKey }: PageProps) => {
  const { data, loading, error } = useStats<PerformanceStats>(filters.app ? '/performance' : null, scopeParams(filters), reloadKey)
  return (
    <>
      <PageHead title="性能" filters={filters} extra={<span> · 阈值按 Web Vitals 官方标准</span>} />
      {error && <ErrorState message={error} />}
      <div className="grid grid-4">
        {VITAL_METRICS.map((metric) => (
          data ? <MetricCard key={metric} metric={metric} summary={data.metrics[metric]} /> : <section key={metric} className="card kpi"><Skeleton height={12} width={64} /><Skeleton height={30} width={96} /><Skeleton height={6} /></section>
        ))}
      </div>
      <Card title="p75 趋势" action={<ChartLegend series={TREND} />}>
        {data ? <TrendChart data={data.series} series={TREND} granularity={data.granularity} yFormat={formatMs} /> : <Skeleton height={240} />}
      </Card>
      <Card title="按页面" hint="p75，按样本数排序">
        <DataTable
          loading={loading}
          rows={data?.pages ?? []}
          rowKey={(r) => r.path}
          columns={[
            { key: 'path', title: '路径', className: 'mono ellipsis', render: (r) => r.path },
            { key: 'samples', title: '样本', align: 'right', render: (r) => formatNumber(r.samples) },
            { key: 'lcp', title: 'LCP', align: 'right', render: (r) => <Rated metric="lcp" value={r.lcp} /> },
            { key: 'fcp', title: 'FCP', align: 'right', render: (r) => <Rated metric="fcp" value={r.fcp} /> },
            { key: 'inp', title: 'INP', align: 'right', render: (r) => <Rated metric="inp" value={r.inp} /> }
          ]}
        />
      </Card>
    </>
  )
}

const Rated = ({ metric, value, className = '' }: { metric: VitalMetric, value: number | null, className?: string }) => (
  <span className={`num rating-${rateMetric(metric, value)} ${className}`}>{formatMetric(metric, value)}</span>
)

const MetricCard = ({ metric, summary }: { metric: VitalMetric, summary: MetricSummary }) => {
  const label = METRIC_LABELS[metric]
  const threshold = VITAL_THRESHOLDS[metric]
  const rated = summary.good + summary.needsImprovement + summary.poor
  const pct = (n: number) => rated > 0 ? n / rated : 0
  return (
    <section className="card kpi" aria-label={label.name}>
      <div className="card-head">
        <h2 className="card-title">{label.name}</h2>
        <span className="card-hint">{label.desc}</span>
      </div>
      <Rated metric={metric} value={summary.p75} className="kpi-value" />
      <div className="kpi-foot">
        <span>p50 {formatMetric(metric, summary.p50)}</span>
        <span>p95 {formatMetric(metric, summary.p95)}</span>
      </div>
      {threshold && rated > 0 && (
        <div className="rating-bar" role="img" aria-label={`${RATING_LABELS.good} ${formatPercent(pct(summary.good))}，${RATING_LABELS.needsImprovement} ${formatPercent(pct(summary.needsImprovement))}，${RATING_LABELS.poor} ${formatPercent(pct(summary.poor))}`}>
          <i className="good" style={{ width: `${pct(summary.good) * 100}%` }} />
          <i className="ni" style={{ width: `${pct(summary.needsImprovement) * 100}%` }} />
          <i className="poor" style={{ width: `${pct(summary.poor) * 100}%` }} />
        </div>
      )}
      <div className="kpi-foot">
        <span>{formatNumber(summary.samples)} 样本</span>
        {threshold && <span className="faint">良好 ≤ {formatMetric(metric, threshold[0])}</span>}
      </div>
    </section>
  )
}
