DROP TABLE visitor_tags;
ALTER TABLE track_events DROP COLUMN utm_campaign, DROP COLUMN utm_medium, DROP COLUMN utm_source;
DROP INDEX track_events_app_visitor_idx;
ALTER TABLE track_events DROP COLUMN visitor_key;
