import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

/**
 * Helper to identify network connectivity errors to PostgreSQL
 */
function isConnectionError(err) {
  const code = err?.code || err?.cause?.code;
  return ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code);
}

/**
 * Authenticates the user via the HTTP-only cookie.
 * Mirrors the pattern in src/app/api/barriers/[id]/route.js.
 */
async function getAuthenticatedUser(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * POST /api/barrier-places
 * Attaches a named campus building/place to a recent barrier report.
 */
export async function POST(request) {
  // 1. Authentication check (401 if not logged in)
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { reportId, placeKey } = body || {};

  // 3. Validate reportId: positive integer
  const parsedReportId = Number(reportId);
  if (!Number.isInteger(parsedReportId) || parsedReportId <= 0) {
    return NextResponse.json(
      { error: 'reportId must be a positive integer.' },
      { status: 400 }
    );
  }

  // 4. Validate placeKey: non-empty string, max 60 characters
  if (
    typeof placeKey !== 'string' ||
    !placeKey.trim() ||
    placeKey.trim().length > 60
  ) {
    return NextResponse.json(
      {
        error:
          'placeKey must be a non-empty string of at most 60 characters.',
      },
      { status: 400 }
    );
  }
  const trimmedPlaceKey = placeKey.trim();

  try {
    // 5. Look up the building by buildings.campus_key = placeKey (404 "Unknown place" if none)
    const buildingResult = await query(
      `SELECT id, campus_key, name
       FROM buildings
       WHERE campus_key = $1`,
      [trimmedPlaceKey]
    );

    if (buildingResult.rowCount === 0) {
      return NextResponse.json({ error: 'Unknown place' }, { status: 404 });
    }

    const building = buildingResult.rows[0];

    // 6. Look up the report in barrier_reports (404 if missing)
    const reportResult = await query(
      `SELECT id, reporter_id, created_at,
              (created_at < NOW() - INTERVAL '15 minutes') AS is_expired
       FROM barrier_reports
       WHERE id = $1`,
      [parsedReportId]
    );

    if (reportResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Barrier report not found.' },
        { status: 404 }
      );
    }

    const report = reportResult.rows[0];

    // 7. Authorization: Only the creator of the report or estate_staff may attach a place
    const isOwner = Number(report.reporter_id) === Number(user.id);
    const isStaff = user.role === 'estate_staff';
    if (!isOwner && !isStaff) {
      return NextResponse.json(
        {
          error:
            'Only the reporter or estate staff can attach a place to this report.',
        },
        { status: 403 }
      );
    }

    // 8. Time check: Only if created in the last 15 minutes (400 "This report can no longer be changed" otherwise)
    const createdAtMs = new Date(report.created_at).getTime();
    const isExpired =
      report.is_expired || Date.now() - createdAtMs > 15 * 60 * 1000;

    if (isExpired) {
      return NextResponse.json(
        { error: 'This report can no longer be changed' },
        { status: 400 }
      );
    }

    // 9. INSERT into barrier_report_places
    try {
      await query(
        `INSERT INTO barrier_report_places (report_id, building_id, place_key, place_name)
         VALUES ($1, $2, $3, $4)`,
        [parsedReportId, building.id, trimmedPlaceKey, building.name]
      );
    } catch (insertErr) {
      // Unique violation (code 23505) -> 409
      if (insertErr?.code === '23505') {
        return NextResponse.json(
          { error: 'This report already has an attached place.' },
          { status: 409 }
        );
      }
      throw insertErr;
    }

    // 10. Return 201 with { reportId, placeKey, placeName }
    return NextResponse.json(
      {
        reportId: parsedReportId,
        placeKey: trimmedPlaceKey,
        placeName: building.name,
      },
      { status: 201 }
    );
  } catch (err) {
    if (isConnectionError(err)) {
      console.error(
        '[POST /api/barrier-places] Database connection error:',
        err
      );
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    console.error('[POST /api/barrier-places] Server error:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/barrier-places?ids=1,2,3
 * Retrieves attached places for the specified barrier report IDs.
 */
export async function GET(request) {
  // 1. Authentication check: any logged-in user may read (401 if not logged in)
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse and validate `ids` query parameter
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');

  if (!idsParam || !idsParam.trim()) {
    return NextResponse.json(
      { error: "Missing 'ids' query parameter." },
      { status: 400 }
    );
  }

  const rawParts = idsParam.split(',');
  if (rawParts.length === 0 || rawParts.length > 200) {
    return NextResponse.json(
      { error: "'ids' must contain between 1 and 200 comma-separated IDs." },
      { status: 400 }
    );
  }

  const idNumbers = [];
  for (const raw of rawParts) {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      return NextResponse.json(
        {
          error:
            "Invalid ID in 'ids'. All IDs must be positive integers.",
        },
        { status: 400 }
      );
    }

    const n = Number(trimmed);
    if (!Number.isSafeInteger(n) || n <= 0) {
      return NextResponse.json(
        {
          error:
            "Invalid ID in 'ids'. All IDs must be positive integers.",
        },
        { status: 400 }
      );
    }
    idNumbers.push(n);
  }

  try {
    // 3. Parameterized query using ANY($1::int[])
    const result = await query(
      `SELECT report_id, place_key, place_name
       FROM barrier_report_places
       WHERE report_id = ANY($1::int[])`,
      [idNumbers]
    );

    // 4. Format into { places: { "<reportId>": { placeKey, placeName }, ... } }
    const places = {};
    for (const row of result.rows) {
      places[String(row.report_id)] = {
        placeKey: row.place_key,
        placeName: row.place_name,
      };
    }

    return NextResponse.json({ places }, { status: 200 });
  } catch (err) {
    if (isConnectionError(err)) {
      console.error(
        '[GET /api/barrier-places] Database connection error:',
        err
      );
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    console.error('[GET /api/barrier-places] Server error:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred.' },
      { status: 500 }
    );
  }
}

