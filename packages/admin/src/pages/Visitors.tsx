import { useEffect, useState, type FormEvent } from 'react'
import type { EventRow, VisitorDetail, VisitorTag, VisitorsStats } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { deleteVisitorTag, putVisitorTag } from '../api/client'
import { formatNumber, formatRegion, shortId } from '../lib/format'
import { formatDateTime } from '../lib/time'
import { hrefOf, visitorHref } from '../state/route'
import { Badge, Card, ErrorState, Skeleton } from '../components/Primitives'
import { DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

export const TagBadge = ({ tag }: { tag: VisitorTag | null }) => {
  if (!tag) return <span className="faint">—</span>
  return <Badge tone={tag.isExcluded ? 'poor' : 'accent'}>{tag.label}{tag.isExcluded ? ' · 已排除' : ''}</Badge>
}

export const Visitors = ({ filters, reloadKey, visitor }: PageProps) => {
  // 标签保存/删除后本地 +1，让列表与详情一起刷新
  const [tagVersion, setTagVersion] = useState(0)
  const { data, loading, error } = useStats<VisitorsStats>(filters.app ? '/visitors' : null, { ...scopeParams(filters), limit: 200 }, reloadKey + tagVersion)
  const rows = data?.visitors ?? []

  return (
    <>
      <PageHead title="访客" filters={filters} />
      {error && <ErrorState message={error} />}
      <Card title="访客列表" hint="按最近访问倒序，最多 200 位；点击行查看画像、事件时间线并打标签">
        <DataTable
          loading={loading}
          rows={rows}
          rowKey={(r) => r.visitorKey}
          onRowClick={(r) => { window.location.hash = visitorHref(r.visitorKey) }}
          emptyHint="所选区间内没有访客"
          columns={[
            { key: 'tag', title: '标签', render: (r) => <TagBadge tag={r.tag} /> },
            { key: 'key', title: '访客', className: 'mono', render: (r) => <span title={r.visitorKey}>{shortId(r.visitorKey, 12)}</span> },
            { key: 'user', title: 'userId', render: (r) => r.userIds.length > 0 ? <strong>{r.userIds.join(', ')}</strong> : <span className="faint">—</span> },
            { key: 'last', title: '最近访问', className: 'num', render: (r) => <span className="muted">{formatDateTime(r.lastSeen)}</span> },
            { key: 'first', title: '首次访问', className: 'num', render: (r) => <span className="muted">{formatDateTime(r.firstSeen)}</span> },
            { key: 'sessions', title: '会话', align: 'right', render: (r) => formatNumber(r.sessions) },
            { key: 'pv', title: 'PV', align: 'right', render: (r) => formatNumber(r.pv) },
            { key: 'region', title: '地域', render: (r) => <span className="muted">{formatRegion(r.geo)}</span> },
            { key: 'device', title: '设备', render: (r) => <span className="muted">{[r.deviceType, r.browser, r.os].filter(Boolean).join(' · ')}</span> }
          ]}
        />
      </Card>
      {visitor && (
        <VisitorDrawer
          visitorKey={visitor}
          filters={filters}
          reloadKey={reloadKey + tagVersion}
          onClose={() => { window.location.hash = hrefOf('visitors') }}
          onTagChanged={() => { setTagVersion((v) => v + 1); }}
        />
      )}
    </>
  )
}

const VisitorDrawer = ({ visitorKey, filters, reloadKey, onClose, onTagChanged }: {
  visitorKey: string
  filters: PageProps['filters']
  reloadKey: number
  onClose: () => void
  onTagChanged: () => void
}) => {
  const { data, loading, error } = useStats<VisitorDetail>(filters.app ? `/visitors/${encodeURIComponent(visitorKey)}` : null, { ...scopeParams(filters), limit: 100 }, reloadKey)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); }
  }, [onClose])

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-label="访客详情" onClick={(e) => { e.stopPropagation(); }}>
        <header className="drawer-head">
          <div>
            <h2 className="card-title">访客详情</h2>
            <div className="mono muted" style={{ wordBreak: 'break-all' }}>{visitorKey}</div>
          </div>
          <button type="button" className="btn" onClick={onClose}>关闭</button>
        </header>
        {error && <ErrorState message={error} />}
        {!data && loading && <Skeleton height={200} />}
        {data && (
          <>
            <Profile profile={data.profile} />
            <TagEditor visitorKey={visitorKey} tag={data.profile.tag} onChanged={onTagChanged} />
            <Timeline events={data.events} />
          </>
        )}
      </aside>
    </div>
  )
}

const Profile = ({ profile }: { profile: VisitorDetail['profile'] }) => (
  <section className="profile">
    <Field label="所在区间" value={`${formatNumber(profile.sessions)} 会话 · ${formatNumber(profile.pv)} PV`} />
    <Field label="最近访问" value={formatDateTime(profile.lastSeen)} />
    <Field label="首次出现" value={`${formatDateTime(profile.lifetimeFirstSeen)}（累计 ${formatNumber(profile.lifetimeSessions)} 会话）`} />
    <Field label="涉及应用" value={profile.apps.join(', ') || '—'} />
    <Field label="userId" value={profile.userIds.join(', ') || '—'} />
    <Field label="地域" value={formatRegion(profile.geo)} />
    <Field label="设备" value={[profile.deviceType, profile.browser, profile.os].filter(Boolean).join(' · ') || '—'} />
  </section>
)

const Field = ({ label, value }: { label: string, value: string }) => (
  <div className="field"><span className="faint">{label}</span><span>{value}</span></div>
)

export const TagEditor = ({ visitorKey, tag, onChanged }: { visitorKey: string, tag: VisitorTag | null, onChanged: () => void }) => {
  const [label, setLabel] = useState(tag?.label ?? '')
  const [isExcluded, setIsExcluded] = useState(tag?.isExcluded ?? false)
  const [note, setNote] = useState(tag?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    setLabel(tag?.label ?? '')
    setIsExcluded(tag?.isExcluded ?? false)
    setNote(tag?.note ?? '')
  }, [tag])

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage(done)
      onChanged()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) { setMessage('标签不能为空'); return }
    void run(async () => { await putVisitorTag(visitorKey, { label: trimmed, isExcluded, note: note.trim() }) }, '已保存')
  }
  const remove = () => { void run(async () => { await deleteVisitorTag(visitorKey) }, '已删除标签') }

  return (
    <form className="tag-editor" onSubmit={save} aria-label="访客标签">
      <div className="card-title">标签</div>
      <div className="tag-editor-row">
        <input type="text" aria-label="标签名" placeholder="如：本人 / 同事 / 测试" maxLength={50} value={label} onChange={(e) => { setLabel(e.target.value); }} />
        <label className="check">
          <input type="checkbox" checked={isExcluded} onChange={(e) => { setIsExcluded(e.target.checked); }} />
          从统计中排除
        </label>
      </div>
      <textarea aria-label="备注" placeholder="备注（可选）" maxLength={500} rows={2} value={note} onChange={(e) => { setNote(e.target.value); }} />
      <div className="tag-editor-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>保存</button>
        {tag && <button type="button" className="btn" disabled={busy} onClick={remove}>删除标签</button>}
        {message && <span className="muted" role="status">{message}</span>}
        {tag && <span className="faint" style={{ marginLeft: 'auto' }}>更新于 {formatDateTime(tag.updatedAt)}</span>}
      </div>
    </form>
  )
}

const Timeline = ({ events }: { events: EventRow[] }) => (
  <section>
    <div className="card-title" style={{ marginBottom: 8 }}>事件时间线（区间内最近 {events.length} 条）</div>
    {events.length === 0
      ? <span className="faint">区间内没有事件</span>
      : (
        <ol className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <span className="muted num">{formatDateTime(e.trackTime)}</span>
              <Badge tone={e.trackType === 'Error' ? 'poor' : e.trackType === 'PageView' ? 'accent' : 'default'}>{e.trackType}</Badge>
              <span className="mono ellipsis" title={e.path}>{e.path}</span>
              <span className="faint">{shortId(e.sessionId, 8)}</span>
            </li>
          ))}
        </ol>
        )}
  </section>
)
