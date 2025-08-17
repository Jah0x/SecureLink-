import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

export function createDb() {
  const cn = process.env.DB;
  if (!cn) {
    throw new Error('DB env var is required (Postgres connection string)');
  }
  const pool = new pg.Pool({ connectionString: cn });
  const db = drizzle(pool);
  return { db, pool };
}
