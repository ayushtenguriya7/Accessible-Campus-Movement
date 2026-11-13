import { NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from './auth';

/**
 * Reads and verifies the user_token cookie from the incoming request.
 *
 * @param {Request | import('next/server').NextRequest} request
 * @returns {Promise<{ id: number, registrationNo: string, role: string, name: string } | null>}
 */
export async function getSessionUser(request) {
  try {
    const token = request?.cookies?.get?.(COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.registrationNo) {
      return null;
    }

    return {
      id: payload.id,
      registrationNo: payload.registrationNo,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

/**
 * Route protection helper for API route handlers.
 * Ensures the requester is authenticated and (optionally) has one of the required roles.
 *
 * Usage:
 *   const auth = await requireUser(request, ['estate_staff']);
 *   if (auth.error) return auth.error;
 *   const { user } = auth;
 *
 * @param {Request | import('next/server').NextRequest} request
 * @param {string[]} [roles] Optional list of allowed roles (e.g. ['estate_staff'])
 * @returns {Promise<{ user: { id: number, registrationNo: string, role: string, name: string }, error?: never } | { error: NextResponse, user?: never }>}
 */
export async function requireUser(request, roles) {
  const user = await getSessionUser(request);

  if (!user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user };
}

