import type { User } from '@prisma/client';

export function toPublicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
