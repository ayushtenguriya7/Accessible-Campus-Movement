import { Pool } from 'pg';

// Single PostgreSQL connection pool (reused across Next.js hot reloads in development)
let pool;

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Missing DATABASE_URL environment variable. Set DATABASE_URL in .env.local to connect to PostgreSQL.'
    );
  }

  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool() {
  if (process.env.NODE_ENV !== 'production') {
    if (!globalThis.__pgPool) {
      globalThis.__pgPool = createPool();
    }
    return globalThis.__pgPool;
  }

  if (!pool) {
    pool = createPool();
  }
  return pool;
}

// Simple helper function to run database queries
export async function query(sqlText, sqlParams) {
  const client = getPool();
  return client.query(sqlText, sqlParams);
}

export default getPool;
