import { PrismaClient } from '@prisma/client';

// Singleton pattern: `tsx watch` (dev) hot-reloads src/*.ts on every save. Without
// caching the client on `global`, each reload would construct a fresh PrismaClient
// and its own connection pool, quickly exhausting Postgres's connection limit.
// Stashing the single instance on `global` survives the module cache being cleared.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
