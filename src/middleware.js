import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Route protection and role-based redirect rules:
 *
 * | User Role / State  | Requested Path                    | Action / Destination            |
 * |--------------------|-----------------------------------|---------------------------------|
 * | Logged out / Exp   | '/'                               | Allow access (login page)       |
 * | Logged out / Exp   | '/dashboard/:path*'               | Redirect to '/'                 |
 * | 'estate_staff'     | '/'                               | Redirect to '/dashboard/estate' |
 * | 'estate_staff'     | '/dashboard' (exact match)        | Redirect to '/dashboard/estate' |
 * | 'estate_staff'     | '/dashboard/estate' or sub-paths  | Allow access                    |
 * | 'student'          | '/'                               | Redirect to '/dashboard'        |
 * | 'student'          | '/dashboard/estate' or sub-paths  | Redirect to '/dashboard'        |
 * | 'student'          | '/dashboard'                      | Allow access                    |
 */

const COOKIE_NAME = 'user_token';
const secretKey = new TextEncoder().encode(
  process.env.JWT_SECRET || 'my_super_secret_jwt_key_123'
);

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // 1. Verify JWT token and extract user role
  let userSession = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey, {
        algorithms: ['HS256'],
      });
      userSession = payload; // Contains user ID, registrationNo, and role
    } catch {
      userSession = null;
    }
  }

  // 2. Unauthenticated / Invalid or expired token:
  // Redirect dashboard visitors back to login page, clearing invalid token cookie
  if (!userSession) {
    if (pathname.startsWith('/dashboard')) {
      const response = NextResponse.redirect(new URL('/', request.url));
      if (token) {
        response.cookies.delete(COOKIE_NAME);
      }
      return response;
    }
    return NextResponse.next();
  }

  const { role } = userSession;

  // 3. Estate Staff routing rules:
  // - Visiting '/' redirects to '/dashboard/estate'
  // - Visiting '/dashboard' (exactly) redirects to '/dashboard/estate'
  // - Visiting '/dashboard/estate' (or sub-paths) is allowed
  if (role === 'estate_staff') {
    if (pathname === '/' || pathname === '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard/estate', request.url));
    }
    return NextResponse.next();
  }

  // 4. Student routing rules:
  // - Visiting '/' redirects to '/dashboard'
  // - Visiting '/dashboard/estate' (or any sub-path) redirects to '/dashboard'
  // - Visiting '/dashboard' is allowed
  if (role === 'student') {
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (pathname === '/dashboard/estate' || pathname.startsWith('/dashboard/estate/')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // 5. Fallback for any other valid session
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
