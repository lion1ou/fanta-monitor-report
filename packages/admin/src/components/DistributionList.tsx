import type { Distribution } from '@fanta/shared'
import { formatNumber } from '../lib/format'
import { Empty, Skeleton } from './Primitives'

// 横向条形分布：条长按 UV 相对最大值；传入 onSelect 时每行可点击下钻
export const DistributionList = ({ rows, loading, onSelect }: { rows: Distribution[], loading?: boolean, onSelect?: (name: string) => void }) => {
  if (loading && rows.length === 0) return <div className="dist">{[0, 1, 2].map((i) => <Skeleton key={i} height={26} />)}</div>
  if (rows.length === 0) return <Empty />
  const max = rows[0].uv
  return (
    <div className="dist">
      <div className="dist-row dist-head"><span /><span className="num" style={{ textAlign: 'right' }}>UV</span><span className="num" style={{ textAlign: 'right' }}>PV</span></div>
      {rows.map((row) => (
        <div className={`dist-row ${onSelect ? 'clickable' : ''}`} key={row.name}
          role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
          onClick={onSelect ? () => { onSelect(row.name); } : undefined}
          onKeyDown={onSelect ? (e) => { if (e.key === 'Enter') onSelect(row.name) } : undefined}>
          <div className="dist-name">
            <span title={onSelect ? `按「${row.name}」下钻` : row.name}>{row.name}</span>
            <div className="bar" aria-hidden="true"><i style={{ width: `${max > 0 ? (row.uv / max) * 100 : 0}%` }} /></div>
          </div>
          <span className="num" style={{ textAlign: 'right' }}>{formatNumber(row.uv)}</span>
          <span className="num muted" style={{ textAlign: 'right' }}>{formatNumber(row.pv)}</span>
        </div>
      ))}
    </div>
  )
}
