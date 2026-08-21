import type { LoginInput, RegisterInput } from '@av-blog/shared';
// Native bindings, not `bcryptjs`: hashing runs on libuv's threadpool instead
// of Node's single JS thread, so a burst of logins doesn't block every other
// request on the event loop while it hashes.
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ConflictError, UnauthorizedError } from '../errors';
import { userRepository, type UserRepository } from '../repositories/user.repository';

const TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 10;

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function createAuthService(repository: UserRepository = userRepository) {
  return {
    async register(input: RegisterInput) {
      const existing = await repository.findByEmail(input.email);
      if (existing) throw new ConflictError('Email already registered');

      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      const user = await repository.create({
        email: input.email,
        passwordHash,
        name: input.name,
      });
      return { user, token: signToken(user.id) };
    },

    async login(input: LoginInput) {
      const user = await repository.findByEmail(input.email);
      if (!user) throw new UnauthorizedError('Invalid email or password');

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new UnauthorizedError('Invalid email or password');

      return { user, token: signToken(user.id) };
    },

    verifyToken(token: string): { sub: string } {
      return jwt.verify(token, env.JWT_SECRET) as { sub: string };
    },
  };
}

export const authService = createAuthService();
