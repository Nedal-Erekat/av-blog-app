// A fixed-window rate limiter: each key may do `limit` things per `windowMs`.
//
// It lives in this process's memory, which is fine for one server. With several server
// instances each would count separately; then you'd keep the counters in a shared store
// such as Redis. The interface would stay the same.

type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  // Injectable clock so tests can move time forward.
  now?: () => number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  // How long until the window resets (useful for a Retry-After header).
  retryAfterMs: number;
};

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    limit,
    tryConsume(key: string): RateLimitResult {
      const time = now();
      let window = windows.get(key);
      if (!window || time - window.startedAt >= windowMs) {
        window = { startedAt: time, count: 0 };
        windows.set(key, window);
        // Drop expired windows now and then, so the map can't grow forever.
        if (windows.size > 10_000) pruneExpired(time);
      }

      const retryAfterMs = window.startedAt + windowMs - time;
      if (window.count >= limit) return { allowed: false, remaining: 0, retryAfterMs };

      window.count += 1;
      return { allowed: true, remaining: limit - window.count, retryAfterMs };
    },
  };

  function pruneExpired(time: number) {
    for (const [key, window] of windows) {
      if (time - window.startedAt >= windowMs) windows.delete(key);
    }
  }
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
