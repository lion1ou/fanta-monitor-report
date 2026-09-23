ALTER TABLE track_events ADD COLUMN bot_verdict text NOT NULL DEFAULT 'none';
ALTER TABLE track_events ADD COLUMN is_webdriver boolean NOT NULL DEFAULT false;
UPDATE track_events SET bot_verdict = 'sdk' WHERE is_bot;
CREATE INDEX track_events_app_bot_time_idx ON track_events (app_name, bot_verdict, track_time DESC);
CREATE INDEX track_events_app_session_idx ON track_events (app_name, session_id);
