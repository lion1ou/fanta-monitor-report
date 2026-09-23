-- 访客键：uuid（跨站 cookie 共享）优先，canvas 指纹兜底
ALTER TABLE track_events ADD COLUMN visitor_key text GENERATED ALWAYS AS (COALESCE(NULLIF(uuid, ''), finger_print, '')) STORED;
CREATE INDEX track_events_app_visitor_idx ON track_events (app_name, visitor_key);

-- UTM 三项在入库时从 page_search 解析
ALTER TABLE track_events
  ADD COLUMN utm_source text NOT NULL DEFAULT '',
  ADD COLUMN utm_medium text NOT NULL DEFAULT '',
  ADD COLUMN utm_campaign text NOT NULL DEFAULT '';

-- 人工访客标记，跨 app 全局；is_excluded 的访客默认不计入统计
CREATE TABLE visitor_tags (
  visitor_key text PRIMARY KEY,
  label       text NOT NULL,
  is_excluded boolean NOT NULL DEFAULT false,
  note        text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
