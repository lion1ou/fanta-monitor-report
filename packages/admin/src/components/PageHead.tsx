import type { ReactNode } from 'react'
import { activeDimensions, type Filters } from '../state/filters'
import { describeRange } from '../lib/time'

const BOTS_TEXT = { exclude: '已排除爬虫', include: '包含爬虫', only: '仅爬虫流量' } as const
const TAGGED_TEXT = { exclude: '已排除标记访客', include: '包含标记访客' } as const

export const PageHead = ({ title, filters, extra }: { title: string, filters: Filters, extra?: ReactNode }) => (
  <div className="page-head">
    <h1>{title}</h1>
    <div className="muted">
      {filters.app && <span className="mono" style={{ marginRight: 12 }}>{filters.app}</span>}
      {describeRange(filters)} · {BOTS_TEXT[filters.bots]} · {TAGGED_TEXT[filters.tagged]}
      {extra}
    </div>
  </div>
)

// 统计接口的公共 query，与服务端 scope 对应（含维度下钻）
export const scopeParams = (filters: Filters) => ({
  app: filters.app,
  from: filters.from,
  to: filters.to,
  bots: filters.bots,
  tagged: filters.tagged,
  ...Object.fromEntries(activeDimensions(filters).map(({ key, value }) => [key, value]))
})
