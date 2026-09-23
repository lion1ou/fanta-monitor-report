import type { PagesStats } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatPercent } from '../lib/format'
import { Card, ErrorState } from '../components/Primitives'
import { BarCell, DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

export const Pages = ({ filters, reloadKey }: PageProps) => {
  const { data, loading, error } = useStats<PagesStats>(filters.app ? '/pages' : null, { ...scopeParams(filters), limit: 50 }, reloadKey)
  const paths = data?.paths ?? []
  const entries = data?.entries ?? []
  const referrers = data?.referrers ?? []
  const totalPv = paths.reduce((sum, r) => sum + r.pv, 0)
  const totalEntries = entries.reduce((sum, r) => sum + r.sessions, 0)
  const totalRef = referrers.reduce((sum, r) => sum + r.sessions, 0)

  return (
    <>
      <PageHead title="页面" filters={filters} />
      {error && <ErrorState message={error} />}
      <div className="grid grid-2-1">
        <Card title="路径访问排名" hint="按 PV 排序，UV 为该路径的独立访客">
          <DataTable
            loading={loading}
            rows={paths}
            rowKey={(r) => r.path}
            columns={[
              { key: 'path', title: '路径', className: 'mono ellipsis', render: (r) => r.path },
              { key: 'pv', title: 'PV', render: (r) => <BarCell value={r.pv} max={paths[0]?.pv ?? 0} label={formatNumber(r.pv)} /> },
              { key: 'share', title: '占比', align: 'right', render: (r) => <span className="muted">{formatPercent(totalPv > 0 ? r.pv / totalPv : 0)}</span> },
              { key: 'uv', title: 'UV', align: 'right', render: (r) => formatNumber(r.uv) }
            ]}
          />
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title="入口页" hint="每个会话的第一个页面">
            <DataTable
              loading={loading}
              rows={entries}
              rowKey={(r) => r.path}
              columns={[
                { key: 'path', title: '路径', className: 'mono ellipsis', render: (r) => r.path },
                { key: 'sessions', title: '会话', render: (r) => <BarCell value={r.sessions} max={entries[0]?.sessions ?? 0} label={formatNumber(r.sessions)} /> },
                { key: 'share', title: '占比', align: 'right', render: (r) => <span className="muted">{formatPercent(totalEntries > 0 ? r.sessions / totalEntries : 0)}</span> }
              ]}
            />
          </Card>
          <Card title="来源" hint="会话首个页面的 referrer 域名；(direct) 为直接访问">
            <DataTable
              loading={loading}
              rows={referrers}
              rowKey={(r) => r.host}
              columns={[
                { key: 'host', title: '域名', className: 'mono ellipsis', render: (r) => r.host },
                { key: 'sessions', title: '会话', render: (r) => <BarCell value={r.sessions} max={referrers[0]?.sessions ?? 0} label={formatNumber(r.sessions)} /> },
                { key: 'share', title: '占比', align: 'right', render: (r) => <span className="muted">{formatPercent(totalRef > 0 ? r.sessions / totalRef : 0)}</span> }
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
