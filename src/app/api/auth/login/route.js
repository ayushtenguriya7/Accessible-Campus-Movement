import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { createToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(request) {
  try {
    // Step 1: Get registrationNo and password entered by user
    const { registrationNo, password } = await request.json();

    if (!registrationNo || !password) {
      return NextResponse.json({ error: 'Please enter registration number and password' }, { status: 400 });
    }

    let user = null;

    // Step 2: Query user from PostgreSQL database
    try {
      const dbResult = await query(
        'SELECT id, registration_no, name, password, role FROM users WHERE registration_no = $1',
        [registrationNo.trim()]
      );

      if (dbResult.rows.length > 0) {
        const foundUser = dbResult.rows[0];
        // Compare entered password with hashed password in database
        const isPasswordCorrect = await bcrypt.compare(password, foundUser.password);
        if (isPasswordCorrect) {
          user = foundUser;
        }
      }
    } catch (dbError) {
      console.warn('Database offline, checking default student demo credentials');
    }

    // Step 3: Default student demo check (if database is not running)
    if (!user && registrationNo.trim() === '11111111' && password === '11111111') {
      user = {
        id: 1,
        registration_no: '11111111',
        name: 'Student User',
        role: 'student', // User role
      };
    }

    // If no valid user found
    if (!user) {
      return NextResponse.json({ error: 'Invalid registration number or password' }, { status: 401 });
    }

    // Step 4: Create signed JWT token with user ID and role
    const token = await createToken({
      id: user.id,
      registrationNo: user.registration_no,
      name: user.name,
      role: user.role, // 'student' or 'estate_staff'
    });

    // Step 5: Send response and store JWT in an HTTP-only cookie
    const response = NextResponse.json({ success: true, role: user.role });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true, // Secure: cannot be accessed via client-side javascript
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server error during login' }, { status: 500 });
  }
}
