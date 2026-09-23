import type { ReactNode } from 'react'
import { formatDelta } from '../lib/format'

export const Card = ({ title, hint, action, children, className = '', ariaLabel }: { title?: string, hint?: string, action?: ReactNode, children: ReactNode, className?: string, ariaLabel?: string }) => (
  <section className={`card ${className}`} aria-label={ariaLabel}>
    {(title ?? action) && (
      <header className="card-head">
        <div>
          {title && <h2 className="card-title">{title}</h2>}
          {hint && <div className="card-hint">{hint}</div>}
        </div>
        {action}
      </header>
    )}
    {children}
  </section>
)

// inverse：数值越低越好（错误率、爬虫占比），环比上升显示为负面色
export const KpiCard = ({ label, value, current, previous, caption, inverse = false }: {
  label: string
  value: string
  current?: number
  previous?: number
  caption?: string
  inverse?: boolean
}) => {
  const delta = current !== undefined && previous !== undefined ? formatDelta(current, previous) : null
  return (
    <section className="card kpi" aria-label={label}>
      <h2 className="card-title">{label}</h2>
      <div className="kpi-value num">{value}</div>
      <div className="kpi-foot">
        {delta && <span className={`delta ${delta.direction} ${inverse ? 'inverse' : ''}`}>{delta.text}</span>}
        {caption && <span>{caption}</span>}
      </div>
    </section>
  )
}

export const Segmented = <T extends string>({ options, value, onChange, label }: { options: ReadonlyArray<{ id: T, label: string }>, value: T, onChange: (id: T) => void, label: string }) => (
  <div className="segmented" role="group" aria-label={label}>
    {options.map((option) => (
      <button key={option.id} type="button" aria-pressed={option.id === value} onClick={() => { onChange(option.id); }}>{option.label}</button>
    ))}
  </div>
)

export const Empty = ({ title = '所选区间内没有数据', hint }: { title?: string, hint?: string }) => (
  <div className="empty" role="status">
    <strong>{title}</strong>
    {hint && <span>{hint}</span>}
  </div>
)

export const ErrorState = ({ message, onRetry }: { message: string, onRetry?: () => void }) => (
  <div className="error-state" role="alert">
    <span>{message}</span>
    {onRetry && <button type="button" className="btn" onClick={onRetry}>重试</button>}
  </div>
)

export const Skeleton = ({ height = 16, width = '100%' }: { height?: number, width?: string | number }) => (
  <span className="skeleton" aria-hidden="true" style={{ display: 'block', height, width }} />
)

export const Badge = ({ tone = 'default', children }: { tone?: 'default' | 'accent' | 'good' | 'ni' | 'poor', children: ReactNode }) => (
  <span className={`badge ${tone === 'default' ? '' : tone}`}>{children}</span>
)
