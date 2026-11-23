import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { getBuildingById } from '@/lib/buildingDto';
import { LIFT_PROBLEMS } from '@/lib/problemTypes';

export async function POST(request) {
  // 1. Authentication check: use the cookie verification pattern from /api/barriers/[id]
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse JSON body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { buildingId, liftNumber, problem, floor, description } = body || {};

  // Validate buildingId: must be a positive integer
  const parsedBuildingId = Number(buildingId);
  if (!Number.isInteger(parsedBuildingId) || parsedBuildingId <= 0) {
    return NextResponse.json(
      { error: 'buildingId must be a positive integer.' },
      { status: 400 }
    );
  }

  // Validate liftNumber: must be an integer
  const parsedLiftNumber = Number(liftNumber);
  if (!Number.isInteger(parsedLiftNumber)) {
    return NextResponse.json(
      { error: 'liftNumber must be an integer.' },
      { status: 400 }
    );
  }

  // Validate problem: must be one of LIFT_PROBLEMS
  if (typeof problem !== 'string' || !LIFT_PROBLEMS.includes(problem)) {
    return NextResponse.json(
      {
        error: `problem must be one of: ${LIFT_PROBLEMS.join(', ')}.`,
      },
      { status: 400 }
    );
  }

  // Validate floor: optional string, trimmed, maximum 20 characters
  let trimmedFloor = null;
  if (floor !== undefined && floor !== null) {
    if (typeof floor !== 'string') {
      return NextResponse.json(
        { error: 'floor must be a string.' },
        { status: 400 }
      );
    }
    const trimmed = floor.trim();
    if (trimmed.length > 20) {
      return NextResponse.json(
        { error: 'floor must not exceed 20 characters.' },
        { status: 400 }
      );
    }
    trimmedFloor = trimmed.length > 0 ? trimmed : null;
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

  // 3. Database transaction
  let client = null;

  try {
    const pool = getPool();
    client = await pool.connect();

    await client.query('BEGIN');

    // 3a. Retrieve and lock building row to validate existence and lifts_total
    const buildingCheck = await client.query(
      `SELECT id, name, lifts_total, lifts_working
       FROM buildings
       WHERE id = $1
       FOR UPDATE`,
      [parsedBuildingId]
    );

    if (buildingCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Building not found.' },
        { status: 400 }
      );
    }

    const buildingRow = buildingCheck.rows[0];
    const buildingName = buildingRow.name;
    const liftsTotal = buildingRow.lifts_total;

    // Validate liftNumber is between 1 and that building's lifts_total
    if (parsedLiftNumber < 1 || parsedLiftNumber > liftsTotal) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        {
          error:
            liftsTotal === 0
              ? `Building "${buildingName}" has no lifts.`
              : `liftNumber must be between 1 and ${liftsTotal} for "${buildingName}".`,
        },
        { status: 400 }
      );
    }

    // 3b. Lower lifts_working by 1 only if it is above 0
    const updateResult = await client.query(
      `UPDATE buildings
       SET lifts_working = lifts_working - 1
       WHERE id = $1 AND lifts_working > 0
       RETURNING id, lifts_working`,
      [parsedBuildingId]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        {
          error:
            'All lifts in this building are already reported as not working.',
        },
        { status: 409 }
      );
    }

    // 3c. Insert into lift_reports with status 'pending'
    let insertResult;
    try {
      insertResult = await client.query(
        `INSERT INTO lift_reports (
           building_id,
           lift_number,
           problem,
           floor,
           description,
           status,
           reporter_id,
           reporter_name
         )
         VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
         RETURNING
           id,
           building_id,
           lift_number,
           problem,
           floor,
           description,
           status,
           reporter_id,
           reporter_name,
           created_at,
           updated_at`,
        [
          parsedBuildingId,
          parsedLiftNumber,
          problem,
          trimmedFloor,
          trimmedDescription,
          user.id ?? null,
          user.name || user.registrationNo || 'Unknown',
        ]
      );
    } catch (insertErr) {
      // 3d. Check for duplicate active report unique constraint violation (code 23505)
      if (insertErr?.code === '23505') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          {
            error: `Lift ${parsedLiftNumber} in ${buildingName} already has an open report.`,
          },
          { status: 409 }
        );
      }
      throw insertErr;
    }

    // 3e. Fetch updated building mapped via toBuildingDto
    const updatedBuilding = await getBuildingById(client, parsedBuildingId);

    // 3f. Commit the transaction
    await client.query('COMMIT');

    const reportRow = insertResult.rows[0];
    const report = {
      id: reportRow.id,
      buildingId: reportRow.building_id,
      liftNumber: reportRow.lift_number,
      problem: reportRow.problem,
      floor: reportRow.floor,
      description: reportRow.description,
      status: reportRow.status,
      reporterId: reportRow.reporter_id,
      reporterName: reportRow.reporter_name,
      createdAt: reportRow.created_at,
      updatedAt: reportRow.updated_at,
      building_id: reportRow.building_id,
      lift_number: reportRow.lift_number,
      reporter_id: reportRow.reporter_id,
      reporter_name: reportRow.reporter_name,
      created_at: reportRow.created_at,
      updated_at: reportRow.updated_at,
    };

    return NextResponse.json(
      { report, building: updatedBuilding },
      { status: 201 }
    );
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback failure if connection was lost
      }
    }

    // Handle database connectivity errors
    const errorCode = err?.code || err?.cause?.code;
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errorCode)) {
      console.error('[POST /api/lift-reports] Database connection error:', err);
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    console.error('[POST /api/lift-reports] Server error:', err);
    return NextResponse.json(
      {
        error:
          'An unexpected server error occurred while reporting the lift issue.',
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

