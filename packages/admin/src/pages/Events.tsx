import { useEffect, useState, type FormEvent } from 'react'
import { TRACK_TYPES, type EventRow, type EventsPage, type TrackType } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatRegion, shortId } from '../lib/format'
import { formatDateTime } from '../lib/time'
import { Badge, Card, ErrorState } from '../components/Primitives'
import { DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'
import { visitorHref } from '../state/route'
import { VERDICT_LABELS } from './Devices'
import { TagBadge } from './Visitors'

const PAGE_SIZE = 50
const TYPE_TONE: Record<TrackType, 'default' | 'accent' | 'poor' | 'good' | 'ni'> = {
  PageView: 'accent', Click: 'default', Error: 'poor', Performance: 'good', Custom: 'ni'
}

export const Events = ({ filters, reloadKey }: PageProps) => {
  const [type, setType] = useState<TrackType | ''>('')
  const [draft, setDraft] = useState({ q: '', path: '' })
  const [applied, setApplied] = useState({ q: '', path: '' })
  const [offset, setOffset] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)

  // 任何筛选变化都回到第一页
  const scopeKey = JSON.stringify(scopeParams(filters))
  useEffect(() => { setOffset(0) }, [scopeKey, type, applied.q, applied.path])

  const { data, loading, error } = useStats<EventsPage>(
    filters.app ? '/events' : null,
    { ...scopeParams(filters), type: type || undefined, q: applied.q || undefined, path: applied.path || undefined, limit: PAGE_SIZE, offset },
    reloadKey
  )
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setApplied({ q: draft.q.trim(), path: draft.path.trim() })
  }

  return (
    <>
      <PageHead title="事件明细" filters={filters} />
      {error && <ErrorState message={error} />}
      <Card>
        <form className="filterbar" style={{ position: 'static', padding: 0, border: 0, background: 'transparent' }} onSubmit={submit}>
          <label className="filter-label" htmlFor="event-type">事件类型</label>
          <select id="event-type" value={type} onChange={(e) => { setType(e.target.value as TrackType | ''); }}>
            <option value="">全部</option>
            {TRACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="search" aria-label="关键词" placeholder="uuid / userId / sessionId / 指纹（精确）" value={draft.q} onChange={(e) => { setDraft({ ...draft, q: e.target.value }); }} style={{ width: 280 }} />
          <input type="search" aria-label="路径前缀" placeholder="路径前缀，如 /pricing" value={draft.path} onChange={(e) => { setDraft({ ...draft, path: e.target.value }); }} style={{ width: 200 }} />
          <button type="submit" className="btn">查询</button>
          {(applied.q || applied.path) && <button type="button" className="btn" onClick={() => { setDraft({ q: '', path: '' }); setApplied({ q: '', path: '' }) }}>清除</button>}
        </form>
        <DataTable
          loading={loading}
          rows={items}
          rowKey={(r) => String(r.id)}
          onRowClick={(r) => { setExpanded((cur) => cur === String(r.id) ? null : String(r.id)); }}
          expandedKey={expanded}
          renderDetail={(r) => <pre className="stack">{JSON.stringify(r.trackData, null, 2)}</pre>}
          emptyHint="调整筛选条件或时间范围"
          columns={[
            { key: 'time', title: '时间', className: 'num', render: (r) => <span className="muted">{formatDateTime(r.trackTime)}</span> },
            { key: 'type', title: '类型', render: (r) => <Badge tone={TYPE_TONE[r.trackType]}>{r.trackType}</Badge> },
            { key: 'path', title: '路径', className: 'mono ellipsis', render: (r) => r.path },
            { key: 'visitor', title: '访客', className: 'mono', render: (r) => <VisitorCell row={r} /> },
            { key: 'device', title: '设备', render: (r) => <span className="muted">{[r.deviceType, r.browser, r.os].filter(Boolean).join(' · ')}</span> },
            { key: 'region', title: '地域', render: (r) => <span className="muted" title={r.geo.country}>{formatRegion(r.geo)}</span> },
            { key: 'bot', title: '爬虫', render: (r) => r.botVerdict === 'none' ? <span className="faint">—</span> : <Badge tone="poor">{VERDICT_LABELS[r.botVerdict]}</Badge> }
          ]}
        />
        <Pager total={total} offset={offset} size={PAGE_SIZE} shown={items.length} onChange={setOffset} />
      </Card>
    </>
  )
}

// 访客列：标签 + userId/访客键缩写，点击进入访客详情（阻止行展开）
const VisitorCell = ({ row }: { row: EventRow }) => (
  <span title={`visitor ${row.visitor}\nsession ${row.sessionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    {row.tag && <TagBadge tag={row.tag} />}
    <a href={visitorHref(row.visitor)} onClick={(e) => { e.stopPropagation(); }}>
      {row.userId ? <strong>{row.userId}</strong> : shortId(row.visitor, 10)}
    </a>
    <span className="faint">· {shortId(row.sessionId, 8)}</span>
  </span>
)

const Pager = ({ total, offset, size, shown, onChange }: { total: number, offset: number, size: number, shown: number, onChange: (offset: number) => void }) => {
  if (total === 0) return null
  const start = offset + 1
  const end = offset + shown
  return (
    <div className="pager">
      <span className="num">共 {formatNumber(total)} 条 · 第 {formatNumber(start)}–{formatNumber(end)} 条</span>
      <div className="pager-buttons">
        <button type="button" className="btn" disabled={offset === 0} onClick={() => { onChange(Math.max(0, offset - size)); }}>上一页</button>
        <button type="button" className="btn" disabled={end >= total || offset + size > 10000} onClick={() => { onChange(offset + size); }}>下一页</button>
      </div>
    </div>
  )
}
