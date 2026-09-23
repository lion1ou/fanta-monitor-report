import type { DevicesStats, OverviewStats, PagesStats } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatPercent } from '../lib/format'
import { hrefOf } from '../state/route'
import { Card, Empty, ErrorState, KpiCard, Skeleton } from '../components/Primitives'
import { CHART_COLORS, ChartLegend, TrendChart } from '../components/TrendChart'
import { BarCell, DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

const PV_UV = [
  { key: 'pv', name: 'PV', color: CHART_COLORS[0] },
  { key: 'uv', name: 'UV', color: CHART_COLORS[1] }
]
const ERRORS = [{ key: 'errors', name: '错误', color: CHART_COLORS[2] }]

export const Overview = ({ filters, reloadKey }: PageProps) => {
  const path = filters.app ? '' : null
  const params = scopeParams(filters)
  const overview = useStats<OverviewStats>(path === null ? null : '/overview', params, reloadKey)
  const pages = useStats<PagesStats>(path === null ? null : '/pages', { ...params, limit: 5 }, reloadKey)
  const devices = useStats<DevicesStats>(path === null ? null : '/devices', params, reloadKey)

  const data = overview.data
  const cur = data?.current
  const prev = data?.previous
  const botShare = (k?: OverviewStats['current']) => k && k.totalPv > 0 ? k.botPv / k.totalPv : 0

  return (
    <>
      <PageHead title="概览" filters={filters} extra={data && <span> · 按{data.granularity === 'hour' ? '小时' : '天'}分桶</span>} />
      {overview.error && <ErrorState message={overview.error} />}

      <div className="grid grid-6">
        {cur && prev
          ? (
            <>
              <KpiCard label="PV" value={formatNumber(cur.pv)} current={cur.pv} previous={prev.pv} caption="较上一周期" />
              <KpiCard label="UV" value={formatNumber(cur.uv)} current={cur.uv} previous={prev.uv} caption="独立访客" />
              <KpiCard label="会话" value={formatNumber(cur.sessions)} current={cur.sessions} previous={prev.sessions} />
              <KpiCard label="登录用户" value={formatNumber(cur.users)} current={cur.users} previous={prev.users} caption="按 userId" />
              <KpiCard label="错误率" value={formatPercent(cur.errorRate)} current={cur.errorRate} previous={prev.errorRate} caption={`${formatNumber(cur.errors)} 次错误`} inverse />
              <KpiCard label="爬虫占比" value={formatPercent(botShare(cur))} current={botShare(cur)} previous={botShare(prev)} caption={`${formatNumber(cur.botPv)} / ${formatNumber(cur.totalPv)} PV`} inverse />
            </>
            )
          : [0, 1, 2, 3, 4, 5].map((i) => <section key={i} className="card kpi"><Skeleton height={12} width={48} /><Skeleton height={30} width={96} /><Skeleton height={12} width={72} /></section>)}
      </div>

      <div className="grid grid-2-1">
        <Card title="访问趋势" action={<ChartLegend series={PV_UV} />}>
          {data ? <TrendChart data={data.series} series={PV_UV} granularity={data.granularity} /> : <Skeleton height={240} />}
        </Card>
        <Card title="错误趋势" action={<ChartLegend series={ERRORS} />}>
          {data ? <TrendChart data={data.series} series={ERRORS} granularity={data.granularity} kind="bar" /> : <Skeleton height={240} />}
        </Card>
      </div>

      <div className="grid grid-2">
        <Card title="Top 页面" action={<a className="muted" href={hrefOf('pages')}>全部 →</a>}>
          <TopPaths pages={pages.data} loading={pages.loading} />
        </Card>
        <Card title="设备类型" action={<a className="muted" href={hrefOf('devices')}>全部 →</a>}>
          <DeviceTypes devices={devices.data} loading={devices.loading} />
        </Card>
      </div>
    </>
  )
}

const TopPaths = ({ pages, loading }: { pages?: PagesStats, loading: boolean }) => {
  const rows = pages?.paths ?? []
  const max = rows[0]?.pv ?? 0
  return (
    <DataTable
      loading={loading}
      rows={rows}
      rowKey={(r) => r.path}
      columns={[
        { key: 'path', title: '路径', className: 'mono ellipsis', render: (r) => r.path },
        { key: 'pv', title: 'PV', render: (r) => <BarCell value={r.pv} max={max} label={formatNumber(r.pv)} /> },
        { key: 'uv', title: 'UV', align: 'right', render: (r) => formatNumber(r.uv) }
      ]}
    />
  )
}

const DeviceTypes = ({ devices, loading }: { devices?: DevicesStats, loading: boolean }) => {
  const rows = devices?.deviceType ?? []
  if (!loading && rows.length === 0) return <Empty />
  const max = rows[0]?.uv ?? 0
  return (
    <DataTable
      loading={loading}
      rows={rows}
      rowKey={(r) => r.name}
      columns={[
        { key: 'name', title: '类型', render: (r) => r.name },
        { key: 'uv', title: 'UV', render: (r) => <BarCell value={r.uv} max={max} label={formatNumber(r.uv)} /> },
        { key: 'pv', title: 'PV', align: 'right', render: (r) => formatNumber(r.pv) }
      ]}
    />
  )
}
