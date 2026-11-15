-- Run after users.sql and buildings.sql. New table; does not change barrier_reports.

CREATE TABLE IF NOT EXISTS lift_reports (
    id SERIAL PRIMARY KEY,
    building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    lift_number INTEGER NOT NULL CHECK (lift_number > 0),
    problem TEXT NOT NULL CHECK (
        problem IN (
            'Not working',
            'Stuck between floors',
            'Door not closing',
            'Unusual noise',
            'Other'
        )
    ),
    floor TEXT CHECK (floor IS NULL OR char_length(floor) <= 20),
    description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'in_progress', 'resolved')
    ),
    reporter_id INTEGER REFERENCES users(id),
    reporter_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One open report per physical lift (prevents duplicate active reports for the same lift)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lift_reports_active
ON lift_reports (building_id, lift_number)
WHERE status <> 'resolved';

-- Index on created_at DESC for chronological sorting
CREATE INDEX IF NOT EXISTS idx_lift_reports_created_at
ON lift_reports (created_at DESC);

-- Index on status for filtering
CREATE INDEX IF NOT EXISTS idx_lift_reports_status
ON lift_reports (status);

