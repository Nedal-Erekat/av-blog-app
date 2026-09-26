import type { NextFunction, Request, Response } from 'express';
import { TooManyRequestsError } from '../errors';
import type { RateLimiter } from '../utils/rate-limiter';

// Limits each signed-in user separately. Must run after requireAuth.
export function rateLimitPerUser(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = limiter.tryConsume(req.userId ?? `ip:${req.ip}`);
    res.setHeader('RateLimit-Limit', limiter.limit);
    res.setHeader('RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      next(
        new TooManyRequestsError(
          `You've reached the limit for AI requests. Try again in ${formatWait(retryAfterSeconds)}.`,
        ),
      );
      return;
    }
    next();
  };
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}
