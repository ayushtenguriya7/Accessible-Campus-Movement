import { Pool } from 'pg';

// Single PostgreSQL connection pool
let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
    });
  }
  return pool;
}

// Simple helper function to run database queries
export async function query(sqlText, sqlParams) {
  const client = getPool();
  return client.query(sqlText, sqlParams);
}

export default getPool;
