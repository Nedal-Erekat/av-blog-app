import express from 'express';
import request from 'supertest';
import { errorHandler } from '../../src/middleware/error-handler';
import { rateLimitPerUser } from '../../src/middleware/rate-limit';
import { createRateLimiter } from '../../src/utils/rate-limiter';

describe('createRateLimiter', () => {
  it('allows `limit` calls per window, then blocks until the window resets', () => {
    let time = 0;
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => time });

    expect(limiter.tryConsume('u1')).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.tryConsume('u1')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.tryConsume('u1')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1000 });

    time = 999;
    expect(limiter.tryConsume('u1').allowed).toBe(false);
    time = 1000;
    expect(limiter.tryConsume('u1')).toMatchObject({ allowed: true, remaining: 1 });
  });

  it('counts each key separately', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });

    expect(limiter.tryConsume('u1').allowed).toBe(true);
    expect(limiter.tryConsume('u2').allowed).toBe(true);
    expect(limiter.tryConsume('u1').allowed).toBe(false);
  });
});

describe('rateLimitPerUser middleware', () => {
  function appFor(limit: number) {
    const app = express();
    app.use((req, _res, next) => {
      req.userId = String(req.headers['x-user']);
      next();
    });
    app.get(
      '/ai',
      rateLimitPerUser(createRateLimiter({ limit, windowMs: 60_000 })),
      (_req, res) => {
        res.json({ ok: true });
      },
    );
    app.use(errorHandler);
    return app;
  }

  it('answers 429 with Retry-After once a user is over the limit, without affecting others', async () => {
    const app = appFor(1);

    const first = await request(app).get('/ai').set('x-user', 'alice');
    expect(first.status).toBe(200);
    expect(first.headers['ratelimit-remaining']).toBe('0');

    const second = await request(app).get('/ai').set('x-user', 'alice');
    expect(second.status).toBe(429);
    expect(Number(second.headers['retry-after'])).toBeGreaterThan(0);
    expect(second.body.error).toMatch(/limit for AI requests/);

    expect((await request(app).get('/ai').set('x-user', 'bob')).status).toBe(200);
  });
});
