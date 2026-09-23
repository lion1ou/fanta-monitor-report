ALTER TABLE track_events ADD COLUMN geo_country text NOT NULL DEFAULT '';
ALTER TABLE track_events ADD COLUMN geo_province text NOT NULL DEFAULT '';
ALTER TABLE track_events ADD COLUMN geo_city text NOT NULL DEFAULT '';
