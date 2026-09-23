import type { Pool } from 'pg'
import type { BotVerdict, EventRow, EventsPage, TrackType } from '@fanta/shared'
import { scopeParams, scopedSql, type Scope } from './scope.js'
import { TAG_JOIN_COLUMNS, tagFromJoin } from './tags.js'

export interface EventsFilter {
  type?: TrackType
  q?: string // 精确匹配 uuid / user_id / session_id / finger_print
  path?: string // 路径前缀
  visitor?: string // 精确匹配访客键
  limit: number
  offset: number
}

interface Row {
  id: string
  track_id: string
  track_time: Date
  track_type: TrackType
  page_path: string
  user_id: string
  visitor: string
  session_id: string
  device_type: string
  browser: string
  os: string
  bot_verdict: BotVerdict
  geo_country: string
  geo_province: string
  geo_city: string
  track_data: Record<string, unknown>
  tag_label: string | null
  tag_is_excluded: boolean | null
  tag_note: string | null
  tag_updated_at: Date | null
}

// 过滤条件按出现顺序编号参数，避免手写 $n 错位
const buildWhere = (filter: EventsFilter, params: unknown[]): string => {
  const clauses: string[] = []
  if (filter.type) {
    params.push(filter.type)
    clauses.push(`track_type = $${params.length}`)
  }
  if (filter.q) {
    params.push(filter.q)
    clauses.push(`(uuid = $${params.length} OR user_id = $${params.length} OR session_id = $${params.length} OR finger_print = $${params.length})`)
  }
  if (filter.path) {
    params.push(filter.path)
    clauses.push(`starts_with(page_path, $${params.length})`)
  }
  if (filter.visitor) {
    params.push(filter.visitor)
    clauses.push(`visitor = $${params.length}`)
  }
  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
}

export const queryEvents = async (pool: Pool, scope: Scope, filter: EventsFilter): Promise<EventsPage> => {
  const params: unknown[] = [...scopeParams(scope)]
  const where = buildWhere(filter, params)
  const cte = `WITH scoped AS (${scopedSql(scope)})`
  const [count, page] = await Promise.all([
    pool.query<{ total: number }>(`${cte} SELECT count(*)::int AS total FROM scoped ${where}`, params),
    pool.query<Row>(
      `${cte} SELECT id, track_id, track_time, track_type, page_path, COALESCE(user_id, '') AS user_id, visitor, session_id, device_type, browser, os, bot_verdict, geo_country, geo_province, geo_city, track_data, ${TAG_JOIN_COLUMNS}
       FROM scoped LEFT JOIN visitor_tags t ON t.visitor_key = scoped.visitor ${where} ORDER BY track_time DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, filter.limit, filter.offset]
    )
  ])
  return {
    total: count.rows[0].total,
    items: page.rows.map((row): EventRow => ({
      id: Number(row.id),
      trackId: row.track_id,
      trackTime: row.track_time.toISOString(),
      trackType: row.track_type,
      path: row.page_path,
      userId: row.user_id,
      visitor: row.visitor,
      sessionId: row.session_id,
      deviceType: row.device_type,
      browser: row.browser,
      os: row.os,
      botVerdict: row.bot_verdict,
      geo: { country: row.geo_country, province: row.geo_province, city: row.geo_city },
      tag: tagFromJoin(row, row.visitor),
      trackData: row.track_data
    }))
  }
}
