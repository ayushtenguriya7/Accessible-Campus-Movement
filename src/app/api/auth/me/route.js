import { NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

// Reads the JWT cookie and returns the logged-in user
export async function GET(request) {
  try {
    // 1. Get token cookie from request
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ user: null });
    }

    // 2. Verify token signature
    const user = await verifyToken(token);
    return NextResponse.json({ user });
  } catch (error) {
    if (error?.digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw error;
    }
    return NextResponse.json({ user: null });
  }
}
