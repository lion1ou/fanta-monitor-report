import type { SourcesStats } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatPercent } from '../lib/format'
import { Card, ErrorState } from '../components/Primitives'
import { DistributionList } from '../components/DistributionList'
import { BarCell, DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

const UTM: Array<{ key: 'utmSource' | 'utmMedium' | 'utmCampaign', title: string, hint: string }> = [
  { key: 'utmSource', title: 'UTM Source', hint: '链接参数 utm_source，如 wechat / newsletter' },
  { key: 'utmMedium', title: 'UTM Medium', hint: '链接参数 utm_medium，如 social / email' },
  { key: 'utmCampaign', title: 'UTM Campaign', hint: '链接参数 utm_campaign' }
]

export const Sources = ({ filters, reloadKey, onFilter }: PageProps) => {
  const { data, loading, error } = useStats<SourcesStats>(filters.app ? '/sources' : null, { ...scopeParams(filters), limit: 50 }, reloadKey)
  const referrers = data?.referrers ?? []
  const totalRef = referrers.reduce((sum, r) => sum + r.sessions, 0)

  return (
    <>
      <PageHead title="来源" filters={filters} />
      {error && <ErrorState message={error} />}
      <div className="grid grid-2-1">
        <Card title="Referrer 域名" hint="会话首个页面的外部来源域名，排除本站跳转；(direct) 为直接访问。点击行按来源下钻">
          <DataTable
            loading={loading}
            rows={referrers}
            rowKey={(r) => r.host}
            onRowClick={(r) => { if (r.host !== '(direct)') onFilter({ referrerHost: r.host }) }}
            columns={[
              { key: 'host', title: '域名', className: 'mono ellipsis', render: (r) => r.host },
              { key: 'sessions', title: '会话', render: (r) => <BarCell value={r.sessions} max={referrers[0]?.sessions ?? 0} label={formatNumber(r.sessions)} /> },
              { key: 'share', title: '占比', align: 'right', render: (r) => <span className="muted">{formatPercent(totalRef > 0 ? r.sessions / totalRef : 0)}</span> }
            ]}
          />
        </Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {UTM.map((dim) => (
            <Card key={dim.key} title={dim.title} hint={dim.hint} ariaLabel={dim.title}>
              <DistributionList rows={data?.[dim.key] ?? []} loading={loading} />
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
