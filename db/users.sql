-- Run order: 1) users.sql 2) buildings.sql
--
-- Users table for authentication in Accessible Campus Movement portal.
-- Used by src/app/api/auth/login/route.js.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    registration_no VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    password        TEXT         NOT NULL,
    role            TEXT         NOT NULL CHECK (role IN ('student', 'estate_staff'))
);

-- ---------------------------------------------------------------------------
-- Seed data: test accounts for development only (passwords: student123, staff123)
-- Safe to re-run: ON CONFLICT (registration_no) DO NOTHING prevents duplicate inserts.
-- ---------------------------------------------------------------------------

INSERT INTO users (registration_no, name, password, role) VALUES
    ('11111111', 'Student User',      '$2b$10$T4yvLXL9h1T3FrEzVrh1lOXo6gh99D88zNuFUUwU0xuFKO/tEeTee', 'student'),
    ('22222222', 'Estate Staff User', '$2b$10$UjYCq57UUUXojntCBUlg9.GkjxC2vCz4lf8mh6TiGapJu4m7kBheS', 'estate_staff')
ON CONFLICT (registration_no) DO NOTHING;

