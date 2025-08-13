import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import pg from "pg";
import Database from "better-sqlite3";

const DB = process.env.DB;
if (!DB) throw new Error("DB env is required");

export const db = DB.startsWith("postgres")
  ? drizzlePg(new pg.Pool({ connectionString: DB }))
  : drizzleSqlite(new Database(DB.replace("sqlite:///", "")));
