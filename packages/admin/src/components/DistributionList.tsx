import type { Distribution } from '@fanta/shared'
import { formatNumber } from '../lib/format'
import { Empty, Skeleton } from './Primitives'

// 横向条形分布：条长按 UV 相对最大值
export const DistributionList = ({ rows, loading }: { rows: Distribution[], loading?: boolean }) => {
  if (loading && rows.length === 0) return <div className="dist">{[0, 1, 2].map((i) => <Skeleton key={i} height={26} />)}</div>
  if (rows.length === 0) return <Empty />
  const max = rows[0].uv
  return (
    <div className="dist">
      <div className="dist-row dist-head"><span /><span className="num" style={{ textAlign: 'right' }}>UV</span><span className="num" style={{ textAlign: 'right' }}>PV</span></div>
      {rows.map((row) => (
        <div className="dist-row" key={row.name}>
          <div className="dist-name">
            <span title={row.name}>{row.name}</span>
            <div className="bar" aria-hidden="true"><i style={{ width: `${max > 0 ? (row.uv / max) * 100 : 0}%` }} /></div>
          </div>
          <span className="num" style={{ textAlign: 'right' }}>{formatNumber(row.uv)}</span>
          <span className="num muted" style={{ textAlign: 'right' }}>{formatNumber(row.pv)}</span>
        </div>
      ))}
    </div>
  )
}
