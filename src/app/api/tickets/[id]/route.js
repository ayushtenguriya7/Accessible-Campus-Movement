import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { getPool } from '@/lib/db';

// Fixed whitelist maps for database column names.
// User/ticket input is never inserted directly into SQL text.
const WORKING_COLUMN_MAP = {
  Ramp: 'ramps_working',
  Lift: 'lifts_working',
  Stairs: 'stairs_working',
};

const TOTAL_COLUMN_MAP = {
  Ramp: 'ramps_total',
  Lift: 'lifts_total',
  Stairs: 'stairs_total',
};

/**
 * PATCH /api/tickets/[id]
 * Resolves a pending barrier ticket and restores 1 working unit to the building.
 * Estate staff only.
 */
export async function PATCH(request, { params }) {
  // Step 1: Authentication & Authorization (estate_staff only)
  const auth = await requireUser(request, ['estate_staff']);
  if (auth.error) {
    return auth.error;
  }

  // Step 2: Await dynamic route params and validate ticket id
  const resolvedParams = await params;
  const rawId = resolvedParams?.id;
  const ticketId = Number(rawId);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json(
      { error: 'Ticket ID must be a positive integer.' },
      { status: 400 }
    );
  }

  // Step 3: Transactional resolution
  let client = null;

  try {
    const pool = getPool();
    client = await pool.connect();

    await client.query('BEGIN');

    // Step 3a: Mark ticket as Resolved if it is currently Pending
    const updateTicketResult = await client.query(
      `UPDATE tickets
       SET status = 'Resolved',
           resolved_at = now(),
           resolved_by = $2
       WHERE id = $1 AND status = 'Pending'
       RETURNING id, building_id, feature_type, description, status, reported_by, created_at, resolved_at, resolved_by`,
      [ticketId, auth.user.registrationNo]
    );

    // If no row was updated, check why: missing ticket vs already resolved
    if (updateTicketResult.rowCount === 0) {
      const checkResult = await client.query(
        `SELECT id, status FROM tickets WHERE id = $1`,
        [ticketId]
      );

      await client.query('ROLLBACK');

      if (checkResult.rowCount === 0) {
        return NextResponse.json(
          { error: 'Ticket not found.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Ticket is already resolved.' },
        { status: 409 }
      );
    }

    const tRow = updateTicketResult.rows[0];
    const featureType = tRow.feature_type;
    const buildingId = tRow.building_id;

    // Step 3b: Raise matching working column by 1, capped at total using LEAST
    const workingColumn = WORKING_COLUMN_MAP[featureType];
    const totalColumn = TOTAL_COLUMN_MAP[featureType];

    if (!workingColumn || !totalColumn) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: `Invalid feature type '${featureType}' on ticket.` },
        { status: 400 }
      );
    }

    await client.query(
      `UPDATE buildings
       SET ${workingColumn} = LEAST(${totalColumn}, ${workingColumn} + 1)
       WHERE id = $1`,
      [buildingId]
    );

    // Step 3c: Fetch updated building row within the same transaction
    const buildingResult = await client.query(
      `SELECT id, campus_key, name, latitude, longitude,
              ramps_total, ramps_working,
              lifts_total, lifts_working,
              stairs_total, stairs_working
       FROM buildings
       WHERE id = $1`,
      [buildingId]
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

    return NextResponse.json({ ticket, building }, { status: 200 });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback error if connection was dropped
      }
    }

    const errorCode = err?.code || err?.cause?.code;
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errorCode)) {
      console.error('[PATCH /api/tickets/[id]] Database connection error:', err);
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    console.error('[PATCH /api/tickets/[id]]', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while resolving the ticket.' },
      { status: 500 }
    );
  } finally {
    // Release the database client back to the pool only if it was acquired
    if (client) {
      client.release();
    }
  }
}

