import { NextResponse } from "next/server";
import { query } from "../../../lib/db";
import { verifyToken, COOKIE_NAME } from "../../../lib/auth";

async function getUser(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  return await verifyToken(token);
}

// GET: Fetch all barrier reports
export async function GET(request) {
  const user = await getUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT
        id,
        reporter_id AS "reporterId",
        reporter_name AS "reporterName",
        barrier_type AS "barrierType",
        description,
        latitude,
        longitude,
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM barrier_reports
       ORDER BY created_at DESC`,
    );

    return NextResponse.json({ reports: result.rows });
  } catch (error) {
    console.error("[GET /api/barriers]", error);

    return NextResponse.json(
      { error: "Unable to fetch barrier reports" },
      { status: 500 },
    );
  }
}

// POST: Submit a barrier report without source/destination
export async function POST(request) {
  const user = await getUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { barrierType, description, latitude, longitude } = body;

    if (
      typeof barrierType !== "string" ||
      !barrierType.trim() ||
      !description?.trim() ||
      description.trim().length > 1000 ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Please provide valid barrier details and location." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(user.id)) {
      return NextResponse.json(
        { error: "Invalid user session." },
        { status: 401 },
      );
    }

    const result = await query(
      `INSERT INTO barrier_reports (
        reporter_id,
        reporter_name,
        barrier_type,
        description,
        latitude,
        longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        reporter_id AS "reporterId",
        reporter_name AS "reporterName",
        barrier_type AS "barrierType",
        description,
        latitude,
        longitude,
        status,
        created_at AS "createdAt"`,
      [
        user.id,
        user.name,
        barrierType.trim(),
        description.trim(),
        latitude,
        longitude,
      ],
    );

    return NextResponse.json(
      {
        message: "Barrier reported successfully.",
        report: result.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/barriers]", error);

    return NextResponse.json(
      { error: "Unable to submit barrier report." },
      { status: 500 },
    );
  }
}
