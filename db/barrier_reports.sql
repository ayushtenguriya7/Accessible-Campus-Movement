
-- Barrier reports submitted by campus users.
-- Run only after confirming the target database.

CREATE TABLE IF NOT EXISTS barrier_reports (
    id SERIAL PRIMARY KEY,

    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reporter_name VARCHAR(100) NOT NULL,

    source_building_id TEXT NOT NULL,
    destination_building_id TEXT NOT NULL,

    barrier_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'resolved')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barrier_reports_status
ON barrier_reports(status);

CREATE INDEX IF NOT EXISTS idx_barrier_reports_route
ON barrier_reports(source_building_id, destination_building_id);
