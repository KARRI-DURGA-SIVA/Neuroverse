
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const globalForPg = globalThis;

const pool =
  globalForPg.neuroversePool ||
  new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.neuroversePool = pool;
}

export async function query(text, params = []) {
  return pool.query(text, params);
}

export function getPool() {
  return pool;
}

export default pool;
