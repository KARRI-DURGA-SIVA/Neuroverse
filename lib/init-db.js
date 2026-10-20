// lib/init-db.js
// Run with: npm run db:init
// Applies schema.sql and seed.sql to the NeonDB database pointed at by DATABASE_URL.
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Create .env.local from .env.example first.");
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  const assistantSchema = fs.readFileSync(path.join(__dirname, "assistant-schema.sql"), "utf8");
  const seed = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");

  console.log("Applying schema...");
  await pool.query(schema);
  console.log("Applying assistant conversation schema...");
  await pool.query(assistantSchema);
  console.log("Applying seed data...");
  await pool.query(seed);
  console.log("Database initialized successfully.");
  await pool.end();
}

main().catch((err) => {
  console.error("DB init failed:", err);
  process.exit(1);
});
