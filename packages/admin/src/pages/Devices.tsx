import type { BotVerdict, DevicesStats, DimensionKey, GeoRegion, UserAgentCategory } from '@fanta/shared'
import type { PageProps } from '../App'
import { useStats } from '../hooks/useStats'
import { formatNumber, formatPercent } from '../lib/format'
import { Badge, Card, Empty, ErrorState, Skeleton } from '../components/Primitives'
import { DistributionList } from '../components/DistributionList'
import { DataTable } from '../components/DataTable'
import { PageHead, scopeParams } from '../components/PageHead'

// 地域按 client_ip 离线解析；省/市缺失时服务端已回退到上一级名称
const GEO_LEVELS: Array<{ key: keyof GeoRegion, title: string }> = [
  { key: 'country', title: '国家' },
  { key: 'province', title: '省份' },
  { key: 'city', title: '城市' }
]

// filterKey 为空的维度不支持下钻（服务端没有对应过滤表达式）
const DIMENSIONS: Array<{ key: keyof Omit<DevicesStats, 'bots' | 'geo' | 'userAgents'>, title: string, filterKey: DimensionKey | null }> = [
  { key: 'deviceType', title: '设备类型', filterKey: 'deviceType' },
  { key: 'os', title: '操作系统', filterKey: 'os' },
  { key: 'browser', title: '浏览器', filterKey: 'browser' },
  { key: 'screen', title: '屏幕分辨率', filterKey: null },
  { key: 'network', title: '网络类型', filterKey: null },
  { key: 'language', title: '语言', filterKey: 'language' }
]

export const VERDICT_LABELS: Record<BotVerdict, string> = {
  webdriver: '自动化驱动',
  ua: 'UA 库命中',
  sdk: 'SDK 列表命中',
  none: '真实访客'
}

const UA_CATEGORY: Record<UserAgentCategory, { label: string, tone: 'default' | 'accent' | 'poor' | 'good' | 'ni' }> = {
  bot: { label: '爬虫/自动化', tone: 'poor' },
  webview: { label: '内嵌 WebView', tone: 'accent' },
  script: { label: '脚本/API 客户端', tone: 'ni' },
  browser: { label: '普通浏览器', tone: 'good' },
  other: { label: '其他', tone: 'default' }
}

export const Devices = ({ filters, reloadKey, onFilter }: PageProps) => {
  const { data, loading, error } = useStats<DevicesStats>(filters.app ? '/devices' : null, scopeParams(filters), reloadKey)
  return (
    <>
      <PageHead title="设备与地域" filters={filters} />
      {error && <ErrorState message={error} />}
      <BotsPanel bots={data?.bots} loading={loading} />
      <Card title="User-Agent 明细" hint="当前筛选范围内按 PV 排序的前 50 个唯一 UA；完整文本自动换行" ariaLabel="User-Agent 明细">
        <DataTable
          loading={loading}
          rows={data?.userAgents ?? []}
          rowKey={(row) => row.userAgent}
          columns={[
            { key: 'category', title: '分类', render: (row) => <Badge tone={UA_CATEGORY[row.category].tone}>{UA_CATEGORY[row.category].label}</Badge> },
            { key: 'ua', title: '完整 User-Agent', className: 'mono ua-full', render: (row) => row.userAgent },
            { key: 'browser', title: '浏览器', render: (row) => row.browser || <span className="faint">—</span> },
            { key: 'os', title: '操作系统', render: (row) => row.os || <span className="faint">—</span> },
            { key: 'device', title: '设备', render: (row) => row.deviceType || <span className="faint">—</span> },
            { key: 'uv', title: 'UV', align: 'right', render: (row) => formatNumber(row.uv) },
            { key: 'pv', title: 'PV', align: 'right', render: (row) => formatNumber(row.pv) }
          ]}
        />
      </Card>
      <div className="grid grid-3">
        {GEO_LEVELS.map((level) => (
          <Card key={level.key} title={level.title} hint="按访问 IP 解析，内网与未知单列；点击下钻" ariaLabel={level.title}>
            <DistributionList rows={data?.geo[level.key] ?? []} loading={loading} onSelect={(value) => { onFilter({ [level.key]: value }); }} />
          </Card>
        ))}
      </div>
      <div className="grid grid-3">
        {DIMENSIONS.map((dim) => (
          <Card key={dim.key} title={dim.title} hint={dim.filterKey ? '按 PageView 统计，UV 排序；点击下钻' : '按 PageView 统计，UV 排序'} ariaLabel={dim.title}>
            <DistributionList rows={data?.[dim.key] ?? []} loading={loading} onSelect={dim.filterKey ? (value) => { onFilter({ [dim.filterKey as DimensionKey]: value }); } : undefined} />
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
