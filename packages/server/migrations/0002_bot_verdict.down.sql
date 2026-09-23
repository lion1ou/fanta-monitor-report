DROP INDEX track_events_app_session_idx;
DROP INDEX track_events_app_bot_time_idx;
ALTER TABLE track_events DROP COLUMN is_webdriver;
ALTER TABLE track_events DROP COLUMN bot_verdict;
