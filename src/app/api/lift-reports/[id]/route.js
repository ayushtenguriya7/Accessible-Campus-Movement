import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';
import { getBuildingById } from '@/lib/buildingDto';

export async function PATCH(request, context) {
  // 1. Authentication and role check (estate_staff only)
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'estate_staff') {
    return NextResponse.json(
      { error: 'Only estate staff can update reports.' },
      { status: 403 }
    );
  }

  // 2. Await dynamic params and validate report id
  const { id } = await context.params;
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json(
      { error: 'Invalid report ID.' },
      { status: 400 }
    );
  }

  // 3. Parse and validate JSON request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { status } = body || {};
  const allowedStatuses = ['pending', 'in_progress', 'resolved'];
  if (!status || !allowedStatuses.includes(status)) {
    return NextResponse.json(
      {
        error: "status must be one of 'pending', 'in_progress', or 'resolved'.",
      },
      { status: 400 }
    );
  }

  // 4. Execute database transaction
  let client = null;

  try {
    const pool = getPool();
    client = await pool.connect();

    await client.query('BEGIN');

    // 4a. SELECT the report with FOR UPDATE (404 if missing)
    const reportResult = await client.query(
      `SELECT id, building_id, lift_number, problem, floor, description,
              status, reporter_id, reporter_name, created_at, updated_at
       FROM lift_reports
       WHERE id = $1
       FOR UPDATE`,
      [reportId]
    );

    if (reportResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Lift report not found.' },
        { status: 404 }
      );
    }

    const existingReport = reportResult.rows[0];
    const currentStatus = existingReport.status;
    const buildingId = existingReport.building_id;

    // 4b. If the status is unchanged return 409 with no changes
    if (currentStatus === status) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Status is already ${status}.` },
        { status: 409 }
      );
    }

    // 4c. Update status and updated_at = NOW()
    let updateReportResult;
    try {
      updateReportResult = await client.query(
        `UPDATE lift_reports
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, building_id, lift_number, problem, floor, description,
                   status, reporter_id, reporter_name, created_at, updated_at`,
        [status, reportId]
      );
    } catch (updateErr) {
      // Check for reopening violation against the unique open-report index
      if (updateErr?.code === '23505') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Another open report exists for this lift.' },
          { status: 409 }
        );
      }
      throw updateErr;
    }

    // 4d. Adjust building's lifts_working
    // from 'pending' or 'in_progress' to 'resolved': lifts_working = LEAST(lifts_total, lifts_working + 1)
    // from 'resolved' to 'pending' or 'in_progress': lifts_working = GREATEST(0, lifts_working - 1)
    // between 'pending' and 'in_progress': no change
    const wasOpen =
      currentStatus === 'pending' || currentStatus === 'in_progress';
    const isNowResolved = status === 'resolved';
    const wasResolved = currentStatus === 'resolved';
    const isNowOpen = status === 'pending' || status === 'in_progress';

    if (wasOpen && isNowResolved) {
      await client.query(
        `UPDATE buildings
         SET lifts_working = LEAST(lifts_total, lifts_working + 1)
         WHERE id = $1`,
        [buildingId]
      );
    } else if (wasResolved && isNowOpen) {
      await client.query(
        `UPDATE buildings
         SET lifts_working = GREATEST(0, lifts_working - 1)
         WHERE id = $1`,
        [buildingId]
      );
    }

    // 4e. Fetch updated building mapped via toBuildingDto
    const updatedBuilding = await getBuildingById(client, buildingId);

    // 4f. Commit transaction
    await client.query('COMMIT');

    const reportRow = updateReportResult.rows[0];
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
      { status: 200 }
    );
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback failure if connection was lost
      }
    }

    const errorCode = err?.code || err?.cause?.code;
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errorCode)) {
      console.error(
        '[PATCH /api/lift-reports/[id]] Database connection error:',
        err
      );
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    console.error('[PATCH /api/lift-reports/[id]] Server error:', err);
    return NextResponse.json(
      {
        error:
          'An unexpected server error occurred while updating the lift report.',
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}

