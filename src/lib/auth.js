import { SignJWT, jwtVerify } from 'jose';

// Secret key used to sign and verify JWT tokens
const secretKey = new TextEncoder().encode(
  process.env.JWT_SECRET || 'my_super_secret_jwt_key_123'
);

export const COOKIE_NAME = 'user_token';

// 1. Create a signed JWT token with user info and role
export async function createToken(userData) {
  return await new SignJWT(userData)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h') // Token expires in 24 hours
    .sign(secretKey);
}

// 2. Read and verify the JWT token
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload; // Returns decoded user: { id, registrationNo, name, role }
  } catch (error) {
    return null; // Return null if token is invalid or expired
  }
}
