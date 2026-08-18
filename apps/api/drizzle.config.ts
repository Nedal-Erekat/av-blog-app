import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// DIRECT_URL, not DATABASE_URL: schema changes need a direct connection.
// PgBouncer's transaction pooling cannot run migration DDL.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
