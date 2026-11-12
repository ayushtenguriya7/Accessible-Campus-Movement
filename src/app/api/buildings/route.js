import { NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import { verifyToken, COOKIE_NAME } from '../../../lib/auth';

export async function GET(request) {
  // 1. Reject unauthenticated requests (mirrors the /api/auth/me pattern)
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await verifyToken(token);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. Fetch all buildings ordered alphabetically
    const result = await query(
      `SELECT id, campus_key, name, latitude, longitude,
              ramps_total, ramps_working,
              lifts_total, lifts_working,
              stairs_total, stairs_working
       FROM buildings
       ORDER BY name ASC`
    );

    // 3. Reshape rows: convert snake_case DB columns to camelCase
    const buildings = result.rows.map((row) => ({
      id:            row.id,
      campusKey:     row.campus_key,
      name:          row.name,
      latitude:      row.latitude,
      longitude:     row.longitude,
      rampsTotal:    row.ramps_total,
      rampsWorking:  row.ramps_working,
      liftsTotal:    row.lifts_total,
      liftsWorking:  row.lifts_working,
      stairsTotal:   row.stairs_total,
      stairsWorking: row.stairs_working,
    }));

    // 4. Return the clean JSON response
    return NextResponse.json({ buildings });
  } catch (err) {
    // 5. Log on the server and return a safe error message to the client
    console.error('[GET /api/buildings]', err);
    return NextResponse.json(
      { error: 'Unable to load building accessibility data' },
      { status: 500 }
    );
  }
}

