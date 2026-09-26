import { Router } from 'express';
import { consentService } from '../mcp/consent.service';
import { draftHandoffService } from '../mcp/draft-handoff.service';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/async-handler';

// Cookie-authenticated endpoints the WEBSITE uses: the OAuth consent page and draft handoffs.
// (The OAuth protocol endpoints themselves, /authorize /token /register, come from the MCP SDK.)
const router = Router();

router.get(
  '/oauth/grants/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await consentService.describe(req.params.id));
  }),
);

router.post(
  '/oauth/grants/:id/approve',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await consentService.approve(req.params.id, req.userId as string));
  }),
);

router.post(
  '/oauth/grants/:id/deny',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await consentService.deny(req.params.id));
  }),
);

router.get(
  '/draft-handoffs/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ draft: await draftHandoffService.get(req.params.id, req.userId as string) });
  }),
);

export default router;
