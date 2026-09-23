import type { DevicesStats, OverviewStats, PagesStats } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatDuration, formatNumber, formatPercent } from '../lib/format'
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

export const Overview = ({ filters, reloadKey, onFilter }: PageProps) => {
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

      <div className="grid grid-4">
        {cur && prev
          ? (
            <>
              <KpiCard label="PV" value={formatNumber(cur.pv)} current={cur.pv} previous={prev.pv} caption="较上一周期" />
              <KpiCard label="UV" value={formatNumber(cur.uv)} current={cur.uv} previous={prev.uv} caption={cur.excludedVisitors > 0 ? `独立访客 · 已排除 ${cur.excludedVisitors} 位标记访客` : '独立访客'} />
              <KpiCard label="会话" value={formatNumber(cur.sessions)} current={cur.sessions} previous={prev.sessions} />
              <KpiCard label="登录用户" value={formatNumber(cur.users)} current={cur.users} previous={prev.users} caption="按 userId" />
              <KpiCard label="跳出率" value={formatPercent(cur.bounceRate)} current={cur.bounceRate} previous={prev.bounceRate} caption="只看 1 页的会话占比" inverse />
              <KpiCard label="平均访问时长" value={formatDuration(cur.avgVisitDuration)} current={cur.avgVisitDuration} previous={prev.avgVisitDuration} caption="会话首末事件间隔" />
              <KpiCard label="错误率" value={formatPercent(cur.errorRate)} current={cur.errorRate} previous={prev.errorRate} caption={`${formatNumber(cur.errors)} 次错误`} inverse />
              <KpiCard label="爬虫占比" value={formatPercent(botShare(cur))} current={botShare(cur)} previous={botShare(prev)} caption={`${formatNumber(cur.botPv)} / ${formatNumber(cur.totalPv)} PV`} inverse />
            </>
            )
          : [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <section key={i} className="card kpi"><Skeleton height={12} width={48} /><Skeleton height={30} width={96} /><Skeleton height={12} width={72} /></section>)}
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
          <TopPaths pages={pages.data} loading={pages.loading} onSelect={(path) => { onFilter({ path }); }} />
        </Card>
        <Card title="设备类型" action={<a className="muted" href={hrefOf('devices')}>全部 →</a>}>
          <DeviceTypes devices={devices.data} loading={devices.loading} onSelect={(deviceType) => { onFilter({ deviceType }); }} />
        </Card>
      </div>
    </>
  )
}

const TopPaths = ({ pages, loading, onSelect }: { pages?: PagesStats, loading: boolean, onSelect: (path: string) => void }) => {
  const rows = pages?.paths ?? []
  const max = rows[0]?.pv ?? 0
  return (
    <DataTable
      loading={loading}
      rows={rows}
      rowKey={(r) => r.path}
      onRowClick={(r) => { onSelect(r.path); }}
      columns={[
        { key: 'path', title: '路径', className: 'mono ellipsis', render: (r) => r.path },
        { key: 'pv', title: 'PV', render: (r) => <BarCell value={r.pv} max={max} label={formatNumber(r.pv)} /> },
        { key: 'uv', title: 'UV', align: 'right', render: (r) => formatNumber(r.uv) }
      ]}
    />
  )
}

const DeviceTypes = ({ devices, loading, onSelect }: { devices?: DevicesStats, loading: boolean, onSelect: (name: string) => void }) => {
  const rows = devices?.deviceType ?? []
  if (!loading && rows.length === 0) return <Empty />
  const max = rows[0]?.uv ?? 0
  return (
    <DataTable
      loading={loading}
      rows={rows}
      rowKey={(r) => r.name}
      onRowClick={(r) => { onSelect(r.name); }}
      columns={[
        { key: 'name', title: '类型', render: (r) => r.name },
        { key: 'uv', title: 'UV', render: (r) => <BarCell value={r.uv} max={max} label={formatNumber(r.uv)} /> },
        { key: 'pv', title: 'PV', align: 'right', render: (r) => formatNumber(r.pv) }
      ]}
    />
  )
}
