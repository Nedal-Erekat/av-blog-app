import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../errors';

/**
 * Keyed by IP + the email in the request body, not IP alone. IP alone lets an
 * attacker burn through the whole window against one victim account from a
 * botnet; email alone lets them credential-stuff every account from a single
 * IP. Combining both means "many attempts against one account" and "many
 * accounts from one source" both still trip the limiter, while a shared
 * office IP with different people logging into different accounts doesn't
 * collide.
 *
 * Falls back to IP alone when the body has no email (e.g. malformed JSON) so
 * the limiter still applies instead of throwing before express-rate-limit's
 * own error handling runs.
 */
function keyByIpAndEmail(req: { ip?: string; body?: { email?: unknown } }): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  return email ? `${req.ip}:${email}` : (req.ip ?? 'unknown');
}

/**
 * Applied to /register and /login only — not the whole /api/auth/* prefix.
 * `/me` is called by `getOptionalUser()` on nearly every server-rendered page
 * load in the web app, so rate-limiting it would throttle ordinary browsing,
 * not just credential guessing.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndEmail,
  handler: (req, _res, next) => {
    next(new TooManyRequestsError('Too many attempts. Try again later.'));
  },
});
