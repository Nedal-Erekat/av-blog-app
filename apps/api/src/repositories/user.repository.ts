import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma';

// Repository pattern: services talk to this interface, never to Prisma directly.
// Lets service-layer unit tests mock data access instead of hitting a real DB,
// and keeps the ORM swappable behind one file if it ever needs to change.
export const userRepository = {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },
  create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    return prisma.user.create({ data });
  },
};

export type UserRepository = typeof userRepository;
