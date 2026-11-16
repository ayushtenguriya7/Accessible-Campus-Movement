import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

const ALLOWED_PROBLEMS = [
  'all',
  'construction',
  'waterlogging',
  'broken_ramp',
  'locked_gate',
  'broken_lift',
  'other',
];

const ALLOWED_STATUSES = ['all', 'pending', 'in_progress', 'resolved'];

const ALLOWED_PAGE_SIZES = [10, 25, 50];

/**
 * Escapes characters with special meaning in PostgreSQL ILIKE patterns: %, _, \
 */
function escapeIlike(str) {
  return str.replace(/[\\%_]/g, '\\$&');
}

/**
 * Validates a YYYY-MM-DD date string against calendar reality.
 */
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Common CTE combining barrier_reports and lift_reports into a unified dataset.
 */
const BASE_CTE = `
WITH combined_reports AS (
  SELECT
    'barrier'::text AS source,
    br.id,
    br.barrier_type::text AS problem,
    br.description::text AS description,
    br.reporter_name::text AS reporter_name,
    br.status::text AS status,
    br.created_at,
    br.updated_at,
    br.latitude,
    br.longitude,
    NULL::integer AS building_id,
    NULL::integer AS lift_number,
    NULL::text AS floor,
    NULL::text AS problem_detail,
    COALESCE(barrier_report_places.place_name, 'Near ' || cb.name, 'Unknown location')::text AS location_name
  FROM barrier_reports br
  LEFT JOIN barrier_report_places ON barrier_report_places.report_id = br.id
  LEFT JOIN LATERAL (
    SELECT b.name
    FROM buildings b
    ORDER BY (
      (b.latitude - br.latitude) * (b.latitude - br.latitude) +
      ((b.longitude - br.longitude) * cos(radians(br.latitude))) * ((b.longitude - br.longitude) * cos(radians(br.latitude)))
    ) ASC
    LIMIT 1
  ) cb ON true

  UNION ALL

  SELECT
    'lift'::text AS source,
    lr.id,
    'broken_lift'::text AS problem,
    lr.description::text AS description,
    lr.reporter_name::text AS reporter_name,
    lr.status::text AS status,
    lr.created_at,
    lr.updated_at,
    b.latitude,
    b.longitude,
    lr.building_id,
    lr.lift_number,
    lr.floor::text AS floor,
    lr.problem::text AS problem_detail,
    b.name::text AS location_name
  FROM lift_reports lr
  JOIN buildings b ON lr.building_id = b.id
)
`;

export async function GET(request) {
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
      { error: 'Only estate staff can access barrier reports.' },
      { status: 403 }
    );
  }

  // 2. Parse and validate query parameters
  const { searchParams } = new URL(request.url);

  // search: optional string
  const searchParam = searchParams.get('search');
  let search = null;
  if (searchParam !== null) {
    const trimmed = searchParam.trim();
    if (trimmed.length > 0) {
      search = trimmed;
    }
  }

  // problem: optional, defaults to 'all'
  const problemParam = searchParams.get('problem');
  let problem = 'all';
  if (problemParam !== null && problemParam !== '') {
    if (!ALLOWED_PROBLEMS.includes(problemParam)) {
      return NextResponse.json(
        {
          error: `Invalid 'problem' filter. Allowed values: ${ALLOWED_PROBLEMS.join(', ')}.`,
        },
        { status: 400 }
      );
    }
    problem = problemParam;
  }

  // status: optional, defaults to 'all'
  const statusParam = searchParams.get('status');
  let status = 'all';
  if (statusParam !== null && statusParam !== '') {
    if (!ALLOWED_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        {
          error: `Invalid 'status' filter. Allowed values: ${ALLOWED_STATUSES.join(', ')}.`,
        },
        { status: 400 }
      );
    }
    status = statusParam;
  }

  // from and to: dates in YYYY-MM-DD format (Asia/Kolkata timezone)
  const fromParam = searchParams.get('from');
  let from = null;
  if (fromParam !== null && fromParam !== '') {
    if (!isValidDate(fromParam)) {
      return NextResponse.json(
        {
          error: "Invalid 'from' date. Must be a valid date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }
    from = fromParam;
  }

  const toParam = searchParams.get('to');
  let to = null;
  if (toParam !== null && toParam !== '') {
    if (!isValidDate(toParam)) {
      return NextResponse.json(
        {
          error: "Invalid 'to' date. Must be a valid date in YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }
    to = toParam;
  }

  if (from && to && from > to) {
    return NextResponse.json(
      { error: "'from' date cannot be after 'to' date." },
      { status: 400 }
    );
  }

  // page: default 1, minimum 1
  const pageParam = searchParams.get('page');
  let page = 1;
  if (pageParam !== null && pageParam !== '') {
    const parsedPage = Number(pageParam);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return NextResponse.json(
        {
          error: "Invalid 'page'. Must be an integer greater than or equal to 1.",
        },
        { status: 400 }
      );
    }
    page = parsedPage;
  }

  // pageSize: allowed 10, 25, 50, default 10
  const pageSizeParam = searchParams.get('pageSize');
  let pageSize = 10;
  if (pageSizeParam !== null && pageSizeParam !== '') {
    const parsedSize = Number(pageSizeParam);
    if (!ALLOWED_PAGE_SIZES.includes(parsedSize)) {
      return NextResponse.json(
        {
          error: `Invalid 'pageSize'. Allowed values: ${ALLOWED_PAGE_SIZES.join(', ')}.`,
        },
        { status: 400 }
      );
    }
    pageSize = parsedSize;
  }

  // 3. Build parameterized conditions
  // countsConditions applies search, problem, and dates (ignores status)
  const countsConditions = [];
  const countsParams = [];

  if (search) {
    countsParams.push(`%${escapeIlike(search)}%`);
    countsConditions.push(
      `(location_name ILIKE $${countsParams.length} OR description ILIKE $${countsParams.length} OR reporter_name ILIKE $${countsParams.length} OR problem_detail ILIKE $${countsParams.length})`
    );
  }

  if (problem !== 'all') {
    countsParams.push(problem);
    countsConditions.push(`problem = $${countsParams.length}`);
  }

  if (from) {
    countsParams.push(`${from} 00:00:00+05:30`);
    countsConditions.push(`created_at >= $${countsParams.length}::timestamptz`);
  }

  if (to) {
    countsParams.push(`${to} 23:59:59.999999+05:30`);
    countsConditions.push(`created_at <= $${countsParams.length}::timestamptz`);
  }

  const countsConditionExpr =
    countsConditions.length > 0 ? countsConditions.join(' AND ') : 'TRUE';

  // allConditions includes all countsConditions plus status
  const allConditions = [...countsConditions];
  const allParams = [...countsParams];

  if (status !== 'all') {
    allParams.push(status);
    allConditions.push(`status = $${allParams.length}`);
  }

  const allWhereClause =
    allConditions.length > 0 ? `WHERE ${allConditions.join(' AND ')}` : '';

  try {
    const pool = getPool();

    // 4. Query KPIs and counts (conditional aggregation over the CTE)
    const statsSql = `
      ${BASE_CTE}
      SELECT
        COUNT(*)::int AS kpi_total,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS kpi_pending,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS kpi_in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS kpi_resolved,
        COUNT(*) FILTER (WHERE ${countsConditionExpr})::int AS count_all,
        COUNT(*) FILTER (WHERE (${countsConditionExpr}) AND status = 'pending')::int AS count_pending,
        COUNT(*) FILTER (WHERE (${countsConditionExpr}) AND status = 'in_progress')::int AS count_in_progress,
        COUNT(*) FILTER (WHERE (${countsConditionExpr}) AND status = 'resolved')::int AS count_resolved
      FROM combined_reports;
    `;

    const statsResult = await pool.query(statsSql, countsParams);
    const statsRow = statsResult.rows[0] || {};

    const kpis = {
      total: Number(statsRow.kpi_total) || 0,
      pending: Number(statsRow.kpi_pending) || 0,
      in_progress: Number(statsRow.kpi_in_progress) || 0,
      resolved: Number(statsRow.kpi_resolved) || 0,
    };

    const counts = {
      all: Number(statsRow.count_all) || 0,
      pending: Number(statsRow.count_pending) || 0,
      in_progress: Number(statsRow.count_in_progress) || 0,
      resolved: Number(statsRow.count_resolved) || 0,
    };

    const total = status === 'all' ? counts.all : (counts[status] ?? 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
    const effectivePage = total > 0 ? Math.min(page, totalPages) : 1;
    const offset = (effectivePage - 1) * pageSize;

    // 5. Query paginated reports
    let reports = [];
    if (total > 0) {
      const reportsParams = [...allParams];
      reportsParams.push(pageSize);
      const limitParamIdx = reportsParams.length;
      reportsParams.push(offset);
      const offsetParamIdx = reportsParams.length;

      const reportsSql = `
        ${BASE_CTE}
        SELECT
          source,
          id,
          problem,
          description,
          reporter_name,
          status,
          created_at,
          updated_at,
          latitude,
          longitude,
          building_id,
          lift_number,
          floor,
          problem_detail,
          location_name
        FROM combined_reports
        ${allWhereClause}
        ORDER BY created_at DESC, source ASC, id DESC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx};
      `;

      const reportsResult = await pool.query(reportsSql, reportsParams);
      reports = reportsResult.rows.map((r) => ({
        key: `${r.source}-${r.id}`,
        source: r.source,
        id: r.id,
        barrierType: r.problem,
        description: r.description,
        latitude: r.latitude != null ? Number(r.latitude) : null,
        longitude: r.longitude != null ? Number(r.longitude) : null,
        status: r.status,
        reporterName: r.reporter_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        buildingId: r.building_id != null ? Number(r.building_id) : null,
        liftNumber: r.lift_number != null ? Number(r.lift_number) : null,
        floor: r.floor ?? null,
        problemDetail: r.problem_detail ?? null,
        locationName: r.location_name,
      }));
    }

    return NextResponse.json({
      reports,
      page: effectivePage,
      pageSize,
      total,
      totalPages,
      counts,
      kpis,
    });
  } catch (err) {
    const errorCode = err?.code || err?.cause?.code;
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errorCode)) {
      console.error(
        '[GET /api/admin/barrier-reports] Database connection error:',
        err
      );
      return NextResponse.json(
        { error: 'The database is unreachable. Please try again.' },
        { status: 503 }
      );
    }

    console.error('[GET /api/admin/barrier-reports] Server error:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred.' },
      { status: 500 }
    );
  }
}

