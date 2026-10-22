import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'user_token';
const secretKey = new TextEncoder().encode(
  process.env.JWT_SECRET || 'my_super_secret_jwt_key_123'
);

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;

  // Verify the JWT token
  let userSession = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      userSession = payload; // Contains user ID, registrationNo, and role
    } catch {
      userSession = null;
    }
  }

  // 1. Route Protection: If not logged in, redirect to login page (/)
  if (pathname.startsWith('/dashboard') && !userSession) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 2. If already logged in and visiting login page (/), go straight to /dashboard
  if (pathname === '/' && userSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
