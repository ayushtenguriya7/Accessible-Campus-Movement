
-- WARNING: This permanently deletes the existing barrier_reports table
-- and all reports stored in it.

DROP TABLE IF EXISTS barrier_reports;

-- Create a fresh barrier reports table.
-- Reports are based on GPS location, not building pairs.

CREATE TABLE barrier_reports (
    id SERIAL PRIMARY KEY,

    reporter_id INTEGER NOT NULL REFERENCES users(id),
    reporter_name VARCHAR(100) NOT NULL,

    barrier_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,

    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'resolved')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_barrier_reports_status
ON barrier_reports(status);
