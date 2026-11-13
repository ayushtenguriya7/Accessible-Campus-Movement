import { NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { verifyToken, COOKIE_NAME } from "../../../../lib/auth";

export async function PATCH(request, context) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await verifyToken(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "estate_staff") {
    return NextResponse.json(
      { error: "Only estate staff can update reports." },
      { status: 403 },
    );
  }

  try {
    const { id } = await context.params;
    const reportId = Number(id);
    const { status } = await request.json();

    const allowedStatuses = ["pending", "in_progress", "resolved"];

    if (
      !Number.isInteger(reportId) ||
      reportId <= 0 ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid report ID or status." },
        { status: 400 },
      );
    }

    const result = await query(
      `UPDATE barrier_reports
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status, updated_at AS "updatedAt"`,
      [status, reportId],
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Barrier report not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Report status updated.",
      report: result.rows[0],
    });
  } catch (error) {
    console.error("[PATCH /api/barriers]", error);
    return NextResponse.json(
      { error: "Unable to update barrier report." },
      { status: 500 },
    );
  }
}
