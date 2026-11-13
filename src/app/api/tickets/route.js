import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { getPool } from '@/lib/db';

// Fixed whitelist map: maps featureType to database column name.
// User input is never inserted directly into SQL text.
const COLUMN_MAP = {
  Ramp: 'ramps_working',
  Lift: 'lifts_working',
  Stairs: 'stairs_working',
};

// Plural display map for error messages.
const FEATURE_PLURAL = {
  Ramp: 'ramps',
  Lift: 'lifts',
  Stairs: 'stairs',
};

export async function POST(request) {
  // Step 1: Authentication
  // requireUser ensures any logged-in role (student or estate_staff) may report an issue.
  const auth = await requireUser(request);
  if (auth.error) {
    return auth.error;
  }

  // Step 2: Validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { buildingId, featureType, description } = body || {};

  // Validate buildingId: must be a positive integer
  const parsedBuildingId = Number(buildingId);
  if (!Number.isInteger(parsedBuildingId) || parsedBuildingId <= 0) {
    return NextResponse.json(
      { error: 'buildingId must be a positive integer.' },
      { status: 400 }
    );
  }

  // Validate featureType: must be one of 'Ramp', 'Lift', 'Stairs'
  if (!['Ramp', 'Lift', 'Stairs'].includes(featureType)) {
    return NextResponse.json(
      { error: "featureType must be one of 'Ramp', 'Lift', or 'Stairs'." },
      { status: 400 }
    );
  }

  // Validate description: optional string, trimmed, maximum 500 characters
  let trimmedDescription = null;
  if (description !== undefined && description !== null) {
    if (typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description must be a string.' },
        { status: 400 }
      );
    }
    const trimmed = description.trim();
    if (trimmed.length > 500) {
      return NextResponse.json(
        { error: 'description must not exceed 500 characters.' },
        { status: 400 }
      );
    }
    trimmedDescription = trimmed.length > 0 ? trimmed : null;
  }

  // Step 3: Database transaction
  // Execute working count update, ticket insertion, and building refetch in ONE transaction.
  let client = null;

  try {
    const pool = getPool();
    client = await pool.connect();

    await client.query('BEGIN');

    // Step 3a: Lower matching working column by 1 only if greater than 0
    const workingColumn = COLUMN_MAP[featureType];
    const updateResult = await client.query(
      `UPDATE buildings
       SET ${workingColumn} = ${workingColumn} - 1
       WHERE id = $1 AND ${workingColumn} > 0
       RETURNING id`,
      [parsedBuildingId]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        {
          error: `All ${FEATURE_PLURAL[featureType]} in this building are already reported as not working.`,
        },
        { status: 409 }
      );
    }

    // Step 3b: Insert the ticket with status 'Pending'
    let ticketResult;
    try {
      ticketResult = await client.query(
        `INSERT INTO tickets (building_id, feature_type, description, status, reported_by)
         VALUES ($1, $2, $3, 'Pending', $4)
         RETURNING id, building_id, feature_type, description, status, reported_by, created_at, resolved_at, resolved_by`,
        [parsedBuildingId, featureType, trimmedDescription, auth.user.registrationNo]
      );
    } catch (insertError) {
      // Handle violation of unique partial index on pending tickets
      if (insertError.code === '23505') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'You already have a pending report for this.' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    // Step 4: Fetch updated building row within the same transaction
    const buildingResult = await client.query(
      `SELECT id, campus_key, name, latitude, longitude,
              ramps_total, ramps_working,
              lifts_total, lifts_working,
              stairs_total, stairs_working
       FROM buildings
       WHERE id = $1`,
      [parsedBuildingId]
    );

    await client.query('COMMIT');

    const bRow = buildingResult.rows[0];
    const building = {
      id: bRow.id,
      campusKey: bRow.campus_key,
      name: bRow.name,
      latitude: bRow.latitude,
      longitude: bRow.longitude,
      rampsTotal: bRow.ramps_total,
      rampsWorking: bRow.ramps_working,
      liftsTotal: bRow.lifts_total,
      liftsWorking: bRow.lifts_working,
      stairsTotal: bRow.stairs_total,
      stairsWorking: bRow.stairs_working,
      features: [
        {
          type: 'Ramp',
          total: bRow.ramps_total,
          working: bRow.ramps_working,
          notWorking: bRow.ramps_total - bRow.ramps_working,
        },
        {
          type: 'Lift',
          total: bRow.lifts_total,
          working: bRow.lifts_working,
          notWorking: bRow.lifts_total - bRow.lifts_working,
        },
        {
          type: 'Stairs',
          total: bRow.stairs_total,
          working: bRow.stairs_working,
          notWorking: bRow.stairs_total - bRow.stairs_working,
        },
      ],
    };

    const tRow = ticketResult.rows[0];
    const ticket = {
      id: tRow.id,
      buildingId: tRow.building_id,
      featureType: tRow.feature_type,
      description: tRow.description,
      status: tRow.status,
      reportedBy: tRow.reported_by,
      createdAt: tRow.created_at,
      resolvedAt: tRow.resolved_at,
      resolvedBy: tRow.resolved_by,
      // Field aliases for compatibility
      building_id: tRow.building_id,
      feature_type: tRow.feature_type,
      reported_by: tRow.reported_by,
      created_at: tRow.created_at,
      resolved_at: tRow.resolved_at,
      resolved_by: tRow.resolved_by,
    };

    return NextResponse.json({ ticket, building }, { status: 201 });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors if connection was dropped
      }
    }

    // Handle database connection errors (unreachable host, refused connection, timeout)
    const errorCode = err?.code || err?.cause?.code;
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errorCode)) {
      console.error('[POST /api/tickets] Database connection error:', err);
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    // Step 5: Error handling - log server-side and return generic 500 response
    console.error('[POST /api/tickets]', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while reporting the issue.' },
      { status: 500 }
    );
  } finally {
    // Release the database client back to the pool only if it was acquired
    if (client) {
      client.release();
    }
  }
}

