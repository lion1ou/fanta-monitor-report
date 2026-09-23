import type { Pool } from 'pg'
import type { VisitorTag } from '@fanta/shared'

export interface TagRow {
  visitor_key: string
  label: string
  is_excluded: boolean
  note: string
  updated_at: Date
}

export const toTag = (row: TagRow | null): VisitorTag | null => row === null
  ? null
  : { visitorKey: row.visitor_key, label: row.label, isExcluded: row.is_excluded, note: row.note, updatedAt: row.updated_at.toISOString() }

// 标签列 LEFT JOIN 后可能整行为 NULL，统一在这里判空
export const tagFromJoin = (row: { tag_label: string | null, tag_is_excluded: boolean | null, tag_note: string | null, tag_updated_at: Date | null }, visitorKey: string): VisitorTag | null =>
  row.tag_label === null || row.tag_is_excluded === null || row.tag_note === null || row.tag_updated_at === null
    ? null
    : toTag({ visitor_key: visitorKey, label: row.tag_label, is_excluded: row.tag_is_excluded, note: row.tag_note, updated_at: row.tag_updated_at })

export const TAG_JOIN_COLUMNS = 't.label AS tag_label, t.is_excluded AS tag_is_excluded, t.note AS tag_note, t.updated_at AS tag_updated_at'

export const upsertVisitorTag = async (pool: Pool, visitorKey: string, tag: Pick<VisitorTag, 'label' | 'isExcluded' | 'note'>): Promise<VisitorTag> => {
  const { rows } = await pool.query<TagRow>(
    `INSERT INTO visitor_tags (visitor_key, label, is_excluded, note, updated_at) VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (visitor_key) DO UPDATE SET label = EXCLUDED.label, is_excluded = EXCLUDED.is_excluded, note = EXCLUDED.note, updated_at = now()
     RETURNING *`,
    [visitorKey, tag.label, tag.isExcluded, tag.note]
  )
  return toTag(rows[0]) as VisitorTag
}

export const deleteVisitorTag = async (pool: Pool, visitorKey: string): Promise<boolean> => {
  const { rowCount } = await pool.query('DELETE FROM visitor_tags WHERE visitor_key = $1', [visitorKey])
  return (rowCount ?? 0) > 0
}
