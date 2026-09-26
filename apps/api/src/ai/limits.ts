import { createRateLimiter } from '../utils/rate-limiter';

// Per-user AI budgets, shared by every entry point (website routes AND the MCP server), so a user
// can't get double the quota by switching from the website to Claude Desktop.
// Cost control: every AI request spends free-tier quota (or, on a paid plan, money). These caps
// stop one user, or one leaked session cookie or token, from burning through it for everyone.
const HOUR_MS = 60 * 60 * 1000;

export const aiLimits = {
  summarize: createRateLimiter({ limit: 20, windowMs: HOUR_MS }),
  ask: createRateLimiter({ limit: 20, windowMs: HOUR_MS }),
  // Lower: one agent run can make up to 8 model calls plus several searches.
  agent: createRateLimiter({ limit: 10, windowMs: HOUR_MS }),
  // Higher: interpreting a command is a single, small model call.
  command: createRateLimiter({ limit: 60, windowMs: HOUR_MS }),
};
