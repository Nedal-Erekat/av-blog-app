import { SummarizePostInputSchema } from '@av-blog/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { aiService } from '../services/ai.service';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

// Logged-in users only: every call costs model quota, so anonymous access would be abuse-prone.
router.post(
  '/summarize',
  requireAuth,
  validate(SummarizePostInputSchema),
  asyncHandler(async (req, res) => {
    const suggestion = await aiService.suggestPostMetadata(req.body);
    res.json({ suggestion });
  }),
);

export default router;
