import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { registrationNo, password } = await request.json();

    // Temporary hardcoded credentials
    if (registrationNo === '11111111' && password === '11111111') {
      const response = NextResponse.json({ success: true });

      response.cookies.set('user_reg', '11111111', {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24, // 1 day
      });

      return response;
    }

    return NextResponse.json(
      { error: 'Invalid registration number or password' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
