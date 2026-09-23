import type { ReactNode } from 'react'
import { Empty, Skeleton } from './Primitives'

export interface Column<T> {
  key: string
  title: string
  align?: 'left' | 'right'
  className?: string
  render: (row: T) => ReactNode
}

export const DataTable = <T,>({ columns, rows, rowKey, loading, emptyHint, onRowClick, expandedKey, renderDetail }: {
  columns: Array<Column<T>>
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  emptyHint?: string
  onRowClick?: (row: T) => void
  expandedKey?: string | null
  renderDetail?: (row: T) => ReactNode
}) => {
  if (loading && rows.length === 0) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={20} />)}</div>
  }
  if (rows.length === 0) return <Empty hint={emptyHint} />
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row)
            const expanded = expandedKey === key
            return [
              <tr key={key} className={`${onRowClick ? 'clickable' : ''} ${expanded ? 'expanded' : ''}`} onClick={onRowClick ? () => { onRowClick(row); } : undefined}>
                {columns.map((c) => <td key={c.key} className={`${c.align === 'right' ? 'num' : ''} ${c.className ?? ''}`}>{c.render(row)}</td>)}
              </tr>,
              expanded && renderDetail && (
                <tr key={`${key}-detail`} className="detail"><td colSpan={columns.length}>{renderDetail(row)}</td></tr>
              )
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

// 占比条：value 相对 max 的比例
export const BarCell = ({ value, max, label }: { value: number, max: number, label: string }) => (
  <div className="bar-cell">
    <div className="bar" aria-hidden="true"><i style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} /></div>
    <span className="num muted" style={{ minWidth: 44, textAlign: 'right' }}>{label}</span>
  </div>
)
