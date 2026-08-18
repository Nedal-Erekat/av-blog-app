import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, type User } from '../db/schema';

// Repository pattern: services talk to this interface, never to Drizzle directly.
// Lets service-layer unit tests mock data access instead of hitting a real DB,
// and keeps the ORM swappable behind one file if it ever needs to change.
export const userRepository = {
  async findByEmail(email: string): Promise<User | null> {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    return user ?? null;
  },
  async findById(id: string): Promise<User | null> {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    return user ?? null;
  },
  async create(data: { email: string; passwordHash: string; name: string }): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },
};

export type UserRepository = typeof userRepository;
