import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let _db: any = null;
let _client: any = null;

function getClient(): any {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _client = postgres(url);
  }
  return _client;
}

export function getDb(): any {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

export const db = getDb();
