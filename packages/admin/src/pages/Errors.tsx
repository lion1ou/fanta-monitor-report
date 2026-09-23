import { useState } from 'react'
import type { ErrorGroup, ErrorOccurrence, ErrorsStats } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatPercent, shortId } from '../lib/format'
import { formatDateTime } from '../lib/time'
import type { Filters } from '../state/filters'
import { Badge, Card, Empty, ErrorState, KpiCard, Skeleton } from '../components/Primitives'
import { CHART_COLORS, TrendChart } from '../components/TrendChart'
import { DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

const SERIES = [{ key: 'errors', name: '错误', color: CHART_COLORS[2] }]
const KIND_LABELS: Record<string, string> = { js: 'JS 异常', promise: 'Promise 拒绝', resource: '资源加载', '': '未分类' }

const groupKey = (g: ErrorGroup) => `${g.kind}|${g.message}`

export const Errors = ({ filters, reloadKey }: PageProps) => {
  const { data, loading, error } = useStats<ErrorsStats>(filters.app ? '/errors' : null, { ...scopeParams(filters), limit: 100 }, reloadKey)
  const [expanded, setExpanded] = useState<string | null>(null)
  const groups = data?.groups ?? []

  return (
    <>
      <PageHead title="错误" filters={filters} />
      {error && <ErrorState message={error} />}
      <div className="grid grid-3">
        {data
          ? (
            <>
              <KpiCard label="错误数" value={formatNumber(data.total)} caption="Error 事件总数" />
              <KpiCard label="影响用户" value={formatNumber(data.affectedUsers)} caption="出现过错误的独立访客" />
              <KpiCard label="错误率" value={formatPercent(data.errorRate)} caption="错误数 / PV" />
            </>
            )
          : [0, 1, 2].map((i) => <section key={i} className="card kpi"><Skeleton height={12} width={48} /><Skeleton height={30} width={96} /></section>)}
      </div>
      <Card title="错误趋势">
        {data ? <TrendChart data={data.series} series={SERIES} granularity={data.granularity} kind="bar" height={200} /> : <Skeleton height={200} />}
      </Card>
      <Card title="错误分组" hint="按类型与 message 聚合，点击行查看最近发生的明细">
        <DataTable
          loading={loading}
          rows={groups}
          rowKey={groupKey}
          onRowClick={(g) => { setExpanded((cur) => cur === groupKey(g) ? null : groupKey(g)); }}
          expandedKey={expanded}
          renderDetail={(g) => <Occurrences filters={filters} group={g} reloadKey={reloadKey} />}
          columns={[
            { key: 'kind', title: '类型', render: (g) => <Badge tone={g.kind === 'resource' ? 'ni' : 'poor'}>{KIND_LABELS[g.kind] ?? g.kind}</Badge> },
            { key: 'message', title: 'Message', className: 'mono ellipsis', render: (g) => <span title={g.message}>{g.message || '(空)'}</span> },
            { key: 'count', title: '次数', align: 'right', render: (g) => <strong className="num">{formatNumber(g.count)}</strong> },
            { key: 'users', title: '用户', align: 'right', render: (g) => formatNumber(g.users) },
            { key: 'lastSeen', title: '最近发生', className: 'num', render: (g) => <span className="muted">{formatDateTime(g.lastSeen)}</span> },
            { key: 'lastPath', title: '最近页面', className: 'mono ellipsis', render: (g) => g.lastPath }
          ]}
        />
      </Card>
    </>
  )
}

const Occurrences = ({ filters, group, reloadKey }: { filters: Filters, group: ErrorGroup, reloadKey: number }) => {
  const { data, loading, error } = useStats<{ items: ErrorOccurrence[] }>('/errors/occurrences', { ...scopeParams(filters), kind: group.kind, message: group.message, limit: 10 }, reloadKey)
  if (error) return <ErrorState message={error} />
  if (loading && !data) return <Skeleton height={80} />
  const items = data?.items ?? []
  if (items.length === 0) return <Empty title="没有明细" />
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="muted" style={{ fontSize: 12 }}>首次 {formatDateTime(group.firstSeen)} · 最近 {formatDateTime(group.lastSeen)} · 显示最近 {items.length} 条</div>
      {items.map((item) => (
        <div key={item.trackId} className="grid grid-2-1" style={{ gap: 16 }}>
          <pre className="stack">{typeof item.trackData.stack === 'string' && item.trackData.stack ? item.trackData.stack : String(item.trackData.message ?? group.message)}</pre>
          <dl className="kv">
            <dt>时间</dt><dd className="num">{formatDateTime(item.trackTime)}</dd>
            <dt>页面</dt><dd className="mono">{item.path}</dd>
            <dt>浏览器</dt><dd>{`${item.browser} ${item.browserVersion}`.trim()}</dd>
            <dt>系统</dt><dd>{`${item.os} ${item.osVersion}`.trim()}</dd>
            <dt>用户</dt><dd className="mono">{item.userId || '匿名'} · {shortId(item.visitor, 12)}</dd>
            {typeof item.trackData.source === 'string' && item.trackData.source && <><dt>来源</dt><dd className="mono">{item.trackData.source}</dd></>}
          </dl>
        </div>
      ))}
    </div>
  )
}
