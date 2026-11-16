-- ============================================================================
-- Sample Report History Seed Script
--
-- Inserts 25 resolved barrier reports and 15 resolved lift reports
-- associated with student test user (registration_no: 12412853).
--
-- Safe to re-run: uses INSERT ... SELECT ... WHERE NOT EXISTS matching on
-- description so existing rows are never duplicated.
--
-- All rows are resolved, so they do not modify any building accessibility counts.
--
-- Remove them at any time with:
--   DELETE FROM barrier_reports WHERE description LIKE 'SAMPLE-%';
--   DELETE FROM lift_reports WHERE description LIKE 'SAMPLE-%';
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Insert 25 Resolved Barrier Reports
-- ----------------------------------------------------------------------------
WITH test_student AS (
    SELECT id, name
    FROM users
    WHERE registration_no = '12412853'
    UNION ALL
    SELECT id, name
    FROM users
    WHERE role = 'student'
    LIMIT 1
)
INSERT INTO barrier_reports (
    reporter_id,
    reporter_name,
    barrier_type,
    description,
    latitude,
    longitude,
    status,
    created_at,
    updated_at
)
SELECT
    u.id,
    u.name,
    s.barrier_type,
    s.description,
    b.latitude + s.lat_offset,
    b.longitude + s.lng_offset,
    'resolved',
    s.created_at,
    s.updated_at
FROM (
    VALUES
        ('construction', 'SAMPLE-01: Scaffolding and material storage along pathway near Central Library.', 'Central Library', 0.00002, 0.00001, NOW() - INTERVAL '58 days', NOW() - INTERVAL '57 days'),
        ('waterlogging', 'SAMPLE-02: Standing rainwater pooling at pedestrian crosswalk near Uni Mall.', 'Uni Mall', 0.00001, 0.00003, NOW() - INTERVAL '56 days', NOW() - INTERVAL '55 days 12 hours'),
        ('broken_ramp',  'SAMPLE-03: Cracked surface and loose handrail on entrance ramp to Block 32.', 'Block 32', 0.00003, 0.00002, NOW() - INTERVAL '53 days', NOW() - INTERVAL '52 days'),
        ('locked_gate',  'SAMPLE-04: East access gate locked during midday classes near Block 34.', 'Block 34', -0.00002, 0.00001, NOW() - INTERVAL '50 days', NOW() - INTERVAL '49 days 6 hours'),
        ('other',        'SAMPLE-05: Overgrown hedge blocking wheelchair passage to Business School.', 'Mittal School of Business', 0.00001, -0.00002, NOW() - INTERVAL '48 days', NOW() - INTERVAL '47 days'),
        ('construction', 'SAMPLE-06: Paver tile replacement work outside Uni Hospital entrance.', 'Uni Hospital', 0.00002, 0.00002, NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days 18 hours'),
        ('waterlogging', 'SAMPLE-07: Drain backup causing deep puddle outside UniPolis pavilion.', 'Baldev Raj Mittal UniPolis', -0.00001, 0.00002, NOW() - INTERVAL '43 days', NOW() - INTERVAL '42 days'),
        ('broken_ramp',  'SAMPLE-08: Steep uneven edge at ramp transition to Block 33 CSE.', 'School of Computer Science & Engineering (Block 33)', 0.00002, -0.00001, NOW() - INTERVAL '40 days', NOW() - INTERVAL '39 days 8 hours'),
        ('locked_gate',  'SAMPLE-09: Perimeter security gate shut on weekend event near Block 27.', 'Block 27', 0.00001, 0.00001, NOW() - INTERVAL '38 days', NOW() - INTERVAL '37 days'),
        ('other',        'SAMPLE-10: Fallen tree branch obstructing walkway towards Humanities Block.', 'Humanities Block', -0.00002, 0.00003, NOW() - INTERVAL '35 days', NOW() - INTERVAL '34 days 14 hours'),
        ('construction', 'SAMPLE-11: Utility trench digging near Central Library north entrance.', 'Central Library', -0.00001, -0.00002, NOW() - INTERVAL '33 days', NOW() - INTERVAL '32 days'),
        ('waterlogging', 'SAMPLE-12: Monsoon overflow on sloped approach to Block 32.', 'Block 32', 0.00002, -0.00001, NOW() - INTERVAL '30 days', NOW() - INTERVAL '29 days 4 hours'),
        ('broken_ramp',  'SAMPLE-13: Damaged anti-slip strips on accessibility ramp at Uni Mall.', 'Uni Mall', -0.00003, 0.00001, NOW() - INTERVAL '28 days', NOW() - INTERVAL '27 days'),
        ('locked_gate',  'SAMPLE-14: Barrier bollard stuck in raised position near Block 34.', 'Block 34', 0.00001, -0.00003, NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days 10 hours'),
        ('other',        'SAMPLE-15: Discarded event staging equipment blocking corridor.', 'Shanti Devi Mittal Auditorium', 0.00002, 0.00001, NOW() - INTERVAL '23 days', NOW() - INTERVAL '22 days'),
        ('construction', 'SAMPLE-16: Electrical conduit repair along corridor to Uni Hospital.', 'Uni Hospital', -0.00001, 0.00002, NOW() - INTERVAL '20 days', NOW() - INTERVAL '19 days 16 hours'),
        ('waterlogging', 'SAMPLE-17: Clogged runoff grate creating slick surface outside Block 33.', 'School of Computer Science & Engineering (Block 33)', 0.00003, 0.00002, NOW() - INTERVAL '18 days', NOW() - INTERVAL '17 days'),
        ('broken_ramp',  'SAMPLE-18: Subsided concrete slab on approach ramp to Business School.', 'Mittal School of Business', -0.00002, 0.00001, NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days 6 hours'),
        ('locked_gate',  'SAMPLE-19: Side entrance turnstile jammed shut near UniPolis.', 'Baldev Raj Mittal UniPolis', 0.00002, -0.00002, NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days'),
        ('other',        'SAMPLE-20: Temporarily parked maintenance cart blocking ramp entrance.', 'Central Library', 0.00001, 0.00002, NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days 12 hours'),
        ('construction', 'SAMPLE-21: Repainting tactile guide tiles outside Block 34.', 'Block 34', 0.00002, 0.00001, NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days'),
        ('waterlogging', 'SAMPLE-22: Heavy puddle accumulation after sudden downpour near Uni Mall.', 'Uni Mall', -0.00002, -0.00001, NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days 8 hours'),
        ('broken_ramp',  'SAMPLE-23: Loose curb stone at edge of wheelchair ramp to Uni Hospital.', 'Uni Hospital', 0.00001, 0.00003, NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
        ('locked_gate',  'SAMPLE-24: Night-time padlock left on pathway gate towards Block 32.', 'Block 32', -0.00001, 0.00002, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days 4 hours'),
        ('other',        'SAMPLE-25: Advertising banner knocked down across walkway to Block 33.', 'School of Computer Science & Engineering (Block 33)', 0.00001, -0.00001, NOW() - INTERVAL '1 day 12 hours', NOW() - INTERVAL '18 hours')
) AS s(barrier_type, description, building_name, lat_offset, lng_offset, created_at, updated_at)
CROSS JOIN test_student u
JOIN buildings b ON b.name = s.building_name
WHERE NOT EXISTS (
    SELECT 1 FROM barrier_reports br WHERE br.description = s.description
);

-- ----------------------------------------------------------------------------
-- 2. Insert 15 Resolved Lift Reports
-- ----------------------------------------------------------------------------
WITH test_student AS (
    SELECT id, name
    FROM users
    WHERE registration_no = '12412853'
    UNION ALL
    SELECT id, name
    FROM users
    WHERE role = 'student'
    LIMIT 1
)
INSERT INTO lift_reports (
    building_id,
    lift_number,
    problem,
    floor,
    description,
    status,
    reporter_id,
    reporter_name,
    created_at,
    updated_at
)
SELECT
    b.id,
    s.lift_number,
    s.problem,
    s.floor,
    s.description,
    'resolved',
    u.id,
    u.name,
    s.created_at,
    s.updated_at
FROM (
    VALUES
        ('Uni Mall',                                            1, 'Door not closing',      '1st Floor',             'SAMPLE-LIFT-01: Sensors misaligned on lift doors.',                        NOW() - INTERVAL '57 days', NOW() - INTERVAL '56 days'),
        ('Uni Mall',                                            2, 'Unusual noise',         '3rd Floor',             'SAMPLE-LIFT-02: Grinding cable noise when descending.',                    NOW() - INTERVAL '53 days', NOW() - INTERVAL '52 days 6 hours'),
        ('Uni Mall',                                            3, 'Not working',           'Ground Floor',          'SAMPLE-LIFT-03: Lift power tripped after electrical surge.',               NOW() - INTERVAL '49 days', NOW() - INTERVAL '48 days'),
        ('Block 34',                                            1, 'Stuck between floors',  'Between 1st & 2nd',     'SAMPLE-LIFT-04: Car briefly halted between floors during peak transit.',   NOW() - INTERVAL '45 days', NOW() - INTERVAL '44 days 12 hours'),
        ('Block 34',                                            2, 'Door not closing',      '2nd Floor',             'SAMPLE-LIFT-05: Outer door shuddering and not latching completely.',       NOW() - INTERVAL '41 days', NOW() - INTERVAL '40 days'),
        ('Block 34',                                            3, 'Other',                 'Ground Floor',          'SAMPLE-LIFT-06: Display indicator button unresponsive for floor 3.',       NOW() - INTERVAL '37 days', NOW() - INTERVAL '36 days 8 hours'),
        ('Central Library',                                     1, 'Not working',           'Ground Floor',          'SAMPLE-LIFT-07: Out of service indicator active.',                         NOW() - INTERVAL '33 days', NOW() - INTERVAL '32 days'),
        ('Central Library',                                     2, 'Unusual noise',         '2nd Floor',             'SAMPLE-LIFT-08: High-pitched motor squeal on ascent.',                     NOW() - INTERVAL '29 days', NOW() - INTERVAL '28 days 18 hours'),
        ('Uni Hospital',                                        1, 'Door not closing',      'Ground Floor',          'SAMPLE-LIFT-09: Safety edge sensor repeatedly triggering reopening.',      NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days'),
        ('Uni Hospital',                                        2, 'Not working',           '1st Floor',             'SAMPLE-LIFT-10: Main control board fault signaled.',                       NOW() - INTERVAL '21 days', NOW() - INTERVAL '20 days 14 hours'),
        ('Uni Hospital',                                        3, 'Other',                 '3rd Floor',             'SAMPLE-LIFT-11: Floor levelling misaligned by approx 2 inches.',           NOW() - INTERVAL '17 days', NOW() - INTERVAL '16 days'),
        ('School of Computer Science & Engineering (Block 33)', 1, 'Stuck between floors',  'Between 2nd & 3rd',     'SAMPLE-LIFT-12: Lift paused between levels with emergency light on.',      NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days 6 hours'),
        ('School of Computer Science & Engineering (Block 33)', 2, 'Unusual noise',         '1st Floor',             'SAMPLE-LIFT-13: Excessive vibration when cabin reaches floor 2.',          NOW() - INTERVAL '9 days',  NOW() - INTERVAL '8 days'),
        ('Mittal School of Business',                           1, 'Door not closing',      'Ground Floor',          'SAMPLE-LIFT-14: Slow door retracting mechanism causing delay.',            NOW() - INTERVAL '5 days',  NOW() - INTERVAL '4 days 10 hours'),
        ('Mittal School of Business',                           2, 'Other',                 '2nd Floor',             'SAMPLE-LIFT-15: Ventilation fan inside car inoperable.',                   NOW() - INTERVAL '2 days',  NOW() - INTERVAL '1 day')
) AS s(building_name, lift_number, problem, floor, description, created_at, updated_at)
CROSS JOIN test_student u
JOIN buildings b ON b.name = s.building_name
WHERE NOT EXISTS (
    SELECT 1 FROM lift_reports lr WHERE lr.description = s.description
);
