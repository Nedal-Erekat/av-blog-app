import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env';
import * as schema from './schema';

// Singleton pattern: `tsx watch` (dev) hot-reloads src/*.ts on every save. Without
// caching the connection on `global`, each reload would open a fresh postgres.js
// pool, quickly exhausting Postgres's connection limit. Stashing the single
// instance on `global` survives the module cache being cleared.
const globalForDb = global as unknown as {
  client?: postgres.Sql;
  db?: PostgresJsDatabase<typeof schema>;
};

// `prepare: false` because DATABASE_URL points at PgBouncer in transaction mode,
// which cannot hold server-side prepared statements across pooled connections.
// Migrations bypass the pooler entirely and use DIRECT_URL instead.
export const client = globalForDb.client ?? postgres(env.DATABASE_URL, { prepare: false });

export const db = globalForDb.db ?? drizzle(client, { schema });

if (env.NODE_ENV !== 'production') {
  globalForDb.client = client;
  globalForDb.db = db;
}

// Tests and one-shot scripts need to release the pool so the process can exit.
export async function closeDb(): Promise<void> {
  await client.end();
}

export { schema };
