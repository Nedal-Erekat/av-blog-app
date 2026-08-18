import 'dotenv/config';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env';

// Runs pending SQL migrations from ./drizzle. Uses drizzle-orm's migrator rather
// than the drizzle-kit CLI so production images need only the runtime dependency
// and the generated .sql files — no dev toolchain at deploy time.
//
// Resolved from __dirname so it works both from src (tsx, dev) and dist (node,
// container): both sit two levels below apps/api.
const migrationsFolder = path.join(__dirname, '../../drizzle');

async function main(): Promise<void> {
  // DIRECT_URL, not DATABASE_URL: PgBouncer's transaction pooling cannot run
  // migration DDL. `max: 1` keeps migrations on a single serialized connection.
  // `onnotice` is silenced because 0000_init is deliberately idempotent: against a
  // database the old Prisma migrations already built, every guarded statement emits
  // an "already exists, skipping" notice that postgres.js would otherwise dump to
  // stderr as an object, making a clean no-op deploy look like a failure.
  const client = postgres(env.DIRECT_URL, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
    console.log('Migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
