import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors';
import { authService } from '../services/auth.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }
  try {
    const payload = authService.verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session'));
  }
}
