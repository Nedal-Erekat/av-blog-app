import { LoginInputSchema, RegisterInputSchema } from '@av-blog/shared';
import { Router, type CookieOptions } from 'express';
import { env } from '../config/env';
import { UnauthorizedError } from '../errors';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { userRepository } from '../repositories/user.repository';
import { authService } from '../services/auth.service';
import { asyncHandler } from '../utils/async-handler';
import { toPublicUser } from '../utils/public-user';

const router = Router();

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post(
  '/register',
  validate(RegisterInputSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.register(req.body);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user: toPublicUser(user) });
  }),
);

router.post(
  '/login',
  validate(LoginInputSchema),
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.login(req.body);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: toPublicUser(user) });
  }),
);

router.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...clearOptions } = COOKIE_OPTIONS;
  res.clearCookie('token', clearOptions);
  res.status(204).send();
});

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.userId as string);
    if (!user) throw new UnauthorizedError('User not found');
    res.json({ user: toPublicUser(user) });
  }),
);

export default router;
