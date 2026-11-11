-- Run order: 1) users.sql 2) buildings.sql
--
-- NOTE: counts for all buildings except the first five are SAMPLE DATA.
-- Replace with real survey numbers.
--
-- Campus buildings table — Accessible Campus Movement portal.
-- Safe to re-run on a fresh database or one that already has the old
-- schema (ramp_status / lift_status / stairs_status columns).
--
--   psql "$DATABASE_URL" -f db/buildings.sql

-- ==========================================================================
-- STEP 1: Create the base table (no-op if it already exists).
-- ==========================================================================

CREATE TABLE IF NOT EXISTS buildings (
    id        SERIAL          PRIMARY KEY,
    name      VARCHAR(100)    NOT NULL UNIQUE,
    latitude  DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL
);

-- ==========================================================================
-- STEP 2: Add new columns (each statement is a no-op if the column exists).
-- campus_key = the `id` string from src/data/campusBuildings.js (e.g. "sample-1").
-- All six count columns default to 0 so existing rows stay valid.
-- ==========================================================================

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS campus_key      TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS ramps_total     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS ramps_working   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lifts_total     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lifts_working   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS stairs_total    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS stairs_working  INTEGER NOT NULL DEFAULT 0;

-- campus_key uniqueness — added separately so it survives a second run.
DO $$ BEGIN
    ALTER TABLE buildings ADD CONSTRAINT buildings_campus_key_unique UNIQUE (campus_key);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================================
-- STEP 3: Named CHECK constraints, added idempotently.
-- Pattern: try to add; swallow duplicate_object (42710) if already present.
-- Each constraint bundles non-negative + working-≤-total for one facility.
-- ==========================================================================

DO $$ BEGIN
    ALTER TABLE buildings ADD CONSTRAINT chk_ramps_counts
        CHECK (ramps_total >= 0 AND ramps_working >= 0 AND ramps_working <= ramps_total);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE buildings ADD CONSTRAINT chk_lifts_counts
        CHECK (lifts_total >= 0 AND lifts_working >= 0 AND lifts_working <= lifts_total);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE buildings ADD CONSTRAINT chk_stairs_counts
        CHECK (stairs_total >= 0 AND stairs_working >= 0 AND stairs_working <= stairs_total);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================================================
-- STEP 4: Drop the old text-status columns (no-op if already gone).
-- ==========================================================================

ALTER TABLE buildings DROP COLUMN IF EXISTS ramp_status;
ALTER TABLE buildings DROP COLUMN IF EXISTS lift_status;
ALTER TABLE buildings DROP COLUMN IF EXISTS stairs_status;

-- ==========================================================================
-- STEP 5: Upsert all 34 buildings from src/data/campusBuildings.js.
--
-- Column order:
--   campus_key, name, latitude, longitude,
--   ramps_total, ramps_working,
--   lifts_total, lifts_working,
--   stairs_total, stairs_working
--
-- ON CONFLICT (name) DO UPDATE SET ensures that editing any number here and
-- re-running the file updates the live database row.
--
-- Names that are duplicated in campusBuildings.js (multiple CSE blocks and
-- multiple "Parking Area" entries share the same .name string) are
-- disambiguated with a block-number or zone suffix so the UNIQUE constraint
-- on `name` is satisfied.
--
-- The first 5 rows use the established database names (Block 32 / 27 / 34,
-- Uni Mall, Central Library) and the coordinates from campusBuildings.js.
-- ==========================================================================

INSERT INTO buildings
    (campus_key, name, latitude, longitude,
     ramps_total, ramps_working, lifts_total, lifts_working, stairs_total, stairs_working)
VALUES

-- ── VERIFIED survey numbers ──────────────────────────────────────────────────
-- campus_key | name                  | lat                  | lng
--            |                       | ramps t/w | lifts t/w | stairs t/w

  ('sample-1', 'Uni Mall',
   31.25580956883715,  75.70564872290824,   2, 2,   4, 3,   1, 0),

  ('sample-2', 'Block 32',
   31.252148515191983, 75.70505888143154,   1, 1,   1, 1,   2, 2),

  ('sample-4', 'Block 34',
   31.25147572875457,  75.70505520205897,   2, 1,   3, 2,   2, 1),

  ('sample-5', 'Central Library',
   31.251950504660904, 75.70380780710491,   1, 0,   2, 2,   1, 1),

  ('sample-8', 'Block 27',
   31.25291483493356,  75.70330975549413,   1, 0,   0, 0,   1, 1),

-- ── SAMPLE DATA — replace with real survey numbers ───────────────────────────

  ('sample-3',  'School of Computer Science & Engineering (Block 33)',
   31.251804632780424, 75.70505498865474,   2, 2,   2, 1,   2, 2),

  ('sample-6',  'School of Computer Science & Engineering (Block 25)',
   31.252925905592996, 75.70247524587754,   1, 1,   2, 2,   2, 2),

  ('sample-7',  'School of Computer Science & Engineering (Block 26)',
   31.252906473723534, 75.70290215655088,   1, 1,   2, 2,   2, 1),

  ('sample-9',  'School of Computer Science & Engineering (Block 28)',
   31.252902336445928, 75.70373735884723,   2, 2,   2, 2,   2, 2),

  ('sample-10', 'Shanti Devi Mittal Auditorium',
   31.252273004406018, 75.70378722942837,   3, 3,   2, 2,   2, 2),

  ('sample-11', 'Baldev Raj Mittal UniPolis',
   31.255247800543966, 75.70510598570596,   2, 2,   3, 3,   2, 1),

  ('sample-12', 'Uni Hospital',
   31.258173015591776, 75.70693994192716,   3, 3,   3, 2,   2, 2),

  ('sample-13', 'LPU Helipad',
   31.25435139346014,  75.70302733612587,   1, 1,   0, 0,   1, 1),

  ('sample-14', 'Humanities Block',
   31.25536086124125,  75.7033904639833,    1, 1,   1, 1,   2, 2),

  ('sample-15', 'LOvely Professional University',
   31.260609585351904, 75.70679287845503,   2, 2,   0, 0,   1, 1),

  ('sample-16', 'Architecture Block',
   31.256994614535152, 75.70729880704914,   2, 2,   1, 1,   2, 1),

  ('sample-17', 'Mittal School of Business',
   31.254830158848666, 75.7056775181745,    2, 2,   2, 2,   2, 2),

  ('sample-18', 'Urban Spido Park',
   31.254048612187805, 75.70567098991852,   1, 1,   0, 0,   1, 1),

  ('sample-19', 'Main Parking Area',
   31.253073711015155, 75.70572367909685,   2, 2,   0, 0,   1, 1),

  ('sample-20', 'Innovation Studio Block',
   31.251147271056364, 75.70534974140992,   1, 1,   1, 1,   2, 2),

  ('sample-21', 'School of Electronics and Electrical Engineering',
   31.251791385701907, 75.70416962844304,   2, 2,   2, 1,   2, 2),

  ('sample-22', 'Computer Applications and Research Department',
   31.252310940671354, 75.70330102810776,   1, 1,   1, 0,   2, 2),

  ('sample-23', 'Sports Complex',
   31.250878551689738, 75.70216507343484,   2, 2,   1, 1,   3, 2),

  ('sample-24', 'School of Hospitality and Tourism Management',
   31.255596368621653, 75.70417665829889,   1, 1,   1, 1,   2, 2),

  ('sample-25', 'Division of Student Welfare',
   31.255282527831042, 75.70612263918802,   2, 2,   2, 2,   1, 1),

  ('sample-26', 'School of Law',
   31.254895437490656, 75.70119466770367,   1, 1,   1, 1,   2, 2),

  ('sample-27', 'School of Mechanical Engineering',
   31.246903236822117, 75.70333417047488,   2, 2,   2, 1,   2, 2),

  ('sample-28', 'School of Bioengineering and Biosciences',
   31.246635804135508, 75.70348045748452,   1, 1,   1, 1,   2, 2),

  ('sample-29', 'School of Agriculture',
   31.24635159391312,  75.70338779947954,   1, 1,   0, 0,   2, 2),

  ('sample-30', 'Parking Area (Zone A)',
   31.253895542888483, 75.70184486590657,   1, 1,   0, 0,   1, 1),

  ('sample-31', 'Parking Area (Zone B)',
   31.2548999662934,   75.70186640514316,   1, 0,   0, 0,   1, 1),

  ('sample-32', 'Parking Area (Zone C)',
   31.246072143665405, 75.70239384075798,   1, 1,   0, 0,   1, 1),

  ('sample-33', 'Parking Area (Zone D)',
   31.246472174828764, 75.70237088108935,   1, 1,   0, 0,   1, 0),

  ('sample-34', 'Parking Area (Zone E)',
   31.251907297496796, 75.7057102956689,    1, 1,   0, 0,   1, 1)

ON CONFLICT (name) DO UPDATE SET
    campus_key     = EXCLUDED.campus_key,
    latitude       = EXCLUDED.latitude,
    longitude      = EXCLUDED.longitude,
    ramps_total    = EXCLUDED.ramps_total,
    ramps_working  = EXCLUDED.ramps_working,
    lifts_total    = EXCLUDED.lifts_total,
    lifts_working  = EXCLUDED.lifts_working,
    stairs_total   = EXCLUDED.stairs_total,
    stairs_working = EXCLUDED.stairs_working;
