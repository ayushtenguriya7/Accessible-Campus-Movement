-- Run after barrier_reports.sql and buildings.sql. Side table that attaches a marked place name to a barrier report; does not change barrier_reports.

CREATE TABLE IF NOT EXISTS barrier_report_places (
    report_id   INTEGER     PRIMARY KEY REFERENCES barrier_reports(id) ON DELETE CASCADE,
    building_id INTEGER     REFERENCES buildings(id) ON DELETE SET NULL,
    place_key   TEXT        NOT NULL,
    place_name  TEXT        NOT NULL CHECK (char_length(place_name) BETWEEN 1 AND 120),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on building_id for fast lookups by building
CREATE INDEX IF NOT EXISTS idx_barrier_report_places_building_id
ON barrier_report_places (building_id);

