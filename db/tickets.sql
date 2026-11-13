-- Run order: users.sql, buildings.sql, tickets.sql
--
-- Barrier tickets table for Accessible Campus Movement portal.
-- Tracks student/staff obstacle reports (broken lifts, blocked ramps, closed stairs)
-- and their estate team resolution lifecycle.
--
-- Safe to re-run:
--   psql "$DATABASE_URL" -f db/tickets.sql

CREATE TABLE IF NOT EXISTS tickets (
    id           SERIAL PRIMARY KEY,
    building_id  INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    feature_type TEXT    NOT NULL CHECK (feature_type IN ('Ramp', 'Lift', 'Stairs')),
    description  TEXT    CHECK (char_length(description) <= 500),
    status       TEXT    NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved')),
    reported_by  TEXT    NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    resolved_by  TEXT,
    CONSTRAINT chk_tickets_resolved_at CHECK (status != 'Resolved' OR resolved_at IS NOT NULL)
);

-- Index for filtering tickets by resolution status (e.g. pending barrier list)
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status);

-- Index for looking up all reports filed for a specific building
CREATE INDEX IF NOT EXISTS idx_tickets_building_id ON tickets (building_id);

-- Unique partial index: prevents the same user from submitting duplicate pending reports
-- for the same feature in the same building until the previous report is resolved
CREATE UNIQUE INDEX IF NOT EXISTS uq_tickets_pending_report
    ON tickets (reported_by, building_id, feature_type)
    WHERE status = 'Pending';

-- ---------------------------------------------------------------------------
-- Seed data: Sample initial barrier tickets
--
-- NOTE: The pending samples are already reflected in the current building counts,
-- so resolving them restores one working unit.
--
-- Test users referenced:
--   Student:      '11111111'
--   Estate Staff: '22222222'
--
-- Safe to re-run: WHERE NOT EXISTS prevents duplicate rows on re-runs.
-- ---------------------------------------------------------------------------

-- 1. Pending tickets (reported by student 11111111)
INSERT INTO tickets (building_id, feature_type, description, status, reported_by, created_at)
SELECT b.id, t.feature_type, t.description, 'Pending', '11111111', t.created_at
FROM (
    VALUES
        ('Block 34',        'Lift',   'Main elevator out of service, maintenance indicator flashing.',             now() - INTERVAL '6 hours'),
        ('Central Library', 'Ramp',   'Entrance ramp handrail broken and access blocked by construction boards.',   now() - INTERVAL '5 hours'),
        ('Uni Mall',        'Lift',   'Lift B doors failing to open on the 1st floor.',                             now() - INTERVAL '4 hours'),
        ('Uni Mall',        'Stairs', 'West stairwell closed for tile repair and deep cleaning.',                   now() - INTERVAL '3 hours'),
        ('Block 27',        'Ramp',   'Concrete ramp surface damaged, blocked with warning cones.',                 now() - INTERVAL '2 hours')
) AS t(building_name, feature_type, description, created_at)
JOIN buildings b ON b.name = t.building_name
WHERE NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE building_id = b.id
      AND feature_type = t.feature_type
      AND status = 'Pending'
      AND reported_by = '11111111'
      AND COALESCE(description, '') = COALESCE(t.description, '')
);

-- 2. Resolved tickets (older reports resolved by estate staff 22222222)
INSERT INTO tickets (building_id, feature_type, description, status, reported_by, created_at, resolved_at, resolved_by)
SELECT b.id, t.feature_type, t.description, 'Resolved', '11111111', t.created_at, t.resolved_at, '22222222'
FROM (
    VALUES
        ('Block 32',       'Ramp', 'Loose tactile paving stone near ramp entrance reported.', now() - INTERVAL '7 days', now() - INTERVAL '5 days'),
        ('Sports Complex', 'Lift', 'Service lift inspection required before tournament.',    now() - INTERVAL '4 days', now() - INTERVAL '1 day')
) AS t(building_name, feature_type, description, created_at, resolved_at)
JOIN buildings b ON b.name = t.building_name
WHERE NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE building_id = b.id
      AND feature_type = t.feature_type
      AND status = 'Resolved'
      AND reported_by = '11111111'
      AND COALESCE(description, '') = COALESCE(t.description, '')
);

