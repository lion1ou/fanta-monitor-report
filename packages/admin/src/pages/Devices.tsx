import type { BotVerdict, DevicesStats, GeoRegion } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatPercent } from '../lib/format'
import { Card, Empty, ErrorState, Skeleton } from '../components/Primitives'
import { DistributionList } from '../components/DistributionList'
import { DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

// 地域按 client_ip 离线解析；省/市缺失时服务端已回退到上一级名称
const GEO_LEVELS: Array<{ key: keyof GeoRegion, title: string }> = [
  { key: 'country', title: '国家' },
  { key: 'province', title: '省份' },
  { key: 'city', title: '城市' }
]

const DIMENSIONS: Array<{ key: keyof Omit<DevicesStats, 'bots' | 'geo'>, title: string }> = [
  { key: 'deviceType', title: '设备类型' },
  { key: 'os', title: '操作系统' },
  { key: 'browser', title: '浏览器' },
  { key: 'screen', title: '屏幕分辨率' },
  { key: 'network', title: '网络类型' },
  { key: 'language', title: '语言' }
]

export const VERDICT_LABELS: Record<BotVerdict, string> = {
  webdriver: '自动化驱动',
  ua: 'UA 库命中',
  sdk: 'SDK 列表命中',
  none: '真实访客'
}

export const Devices = ({ filters, reloadKey }: PageProps) => {
  const { data, loading, error } = useStats<DevicesStats>(filters.app ? '/devices' : null, scopeParams(filters), reloadKey)
  return (
    <>
      <PageHead title="访客与设备" filters={filters} />
      {error && <ErrorState message={error} />}
      <BotsPanel bots={data?.bots} loading={loading} />
      <div className="grid grid-3">
        {GEO_LEVELS.map((level) => (
          <Card key={level.key} title={level.title} hint="按访问 IP 解析，内网与未知单列" ariaLabel={level.title}>
            <DistributionList rows={data?.geo[level.key] ?? []} loading={loading} />
          </Card>
        ))}
      </div>
      <div className="grid grid-3">
        {DIMENSIONS.map((dim) => (
          <Card key={dim.key} title={dim.title} hint="按 PageView 统计，UV 排序">
            <DistributionList rows={data?.[dim.key] ?? []} loading={loading} />
          </Card>
        ))}
      </div>
    </>
  )
}

const BotsPanel = ({ bots, loading }: { bots?: DevicesStats['bots'], loading: boolean }) => {
  const totalPv = bots ? bots.realPv + bots.botPv : 0
  const botShare = totalPv > 0 && bots ? bots.botPv / totalPv : 0
  return (
    <Card title="爬虫识别" hint="不受顶部爬虫开关影响，始终展示全部流量的拆分" ariaLabel="爬虫识别">
      {!bots
        ? <Skeleton height={120} />
        : (
          <div className="grid grid-3">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="grid grid-2">
                <Stat label="真实访客 UV" value={formatNumber(bots.realUv)} sub={`${formatNumber(bots.realPv)} PV`} />
                <Stat label="爬虫 UV" value={formatNumber(bots.botUv)} sub={`${formatNumber(bots.botPv)} PV`} tone="poor" />
              </div>
              <div>
                <div className="rating-bar" role="img" aria-label={`真实 ${formatPercent(1 - botShare)}，爬虫 ${formatPercent(botShare)}`}>
                  <i className="good" style={{ width: `${(1 - botShare) * 100}%` }} />
                  <i className="poor" style={{ width: `${botShare * 100}%` }} />
                </div>
                <div className="legend" style={{ marginTop: 6 }}>
                  <span><i style={{ background: 'var(--good)' }} />真实 {formatPercent(1 - botShare)}</span>
                  <span><i style={{ background: 'var(--poor)' }} />爬虫 {formatPercent(botShare)}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="card-title" style={{ marginBottom: 8 }}>判定来源</div>
              {bots.verdicts.length === 0
                ? <Empty title="没有爬虫流量" />
                : (
                  <DistributionList rows={bots.verdicts.map((v) => ({ name: VERDICT_LABELS[v.verdict], uv: v.pv, pv: v.pv }))} />
                  )}
            </div>
            <div>
              <div className="card-title" style={{ marginBottom: 8 }}>Top 爬虫 UA</div>
              <DataTable
                rows={bots.agents}
                rowKey={(r) => r.name}
                emptyHint="没有爬虫流量"
                columns={[
                  { key: 'name', title: 'User-Agent', className: 'mono ellipsis', render: (r) => <span title={r.name}>{r.name}</span> },
                  { key: 'pv', title: 'PV', align: 'right', render: (r) => formatNumber(r.pv) }
                ]}
              />
            </div>
          </div>
          )}
    </Card>
  )
}

const Stat = ({ label, value, sub, tone }: { label: string, value: string, sub: string, tone?: 'poor' }) => (
  <div>
    <div className="card-title">{label}</div>
    <div className={`kpi-value num ${tone === 'poor' ? 'rating-poor' : ''}`} style={{ fontSize: 22 }}>{value}</div>
    <div className="faint" style={{ fontSize: 12 }}>{sub}</div>
  </div>
)
