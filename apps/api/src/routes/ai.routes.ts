import { AskBlogInputSchema, SummarizePostInputSchema } from '@av-blog/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { aiService } from '../services/ai.service';
import { askService } from '../services/ask.service';
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

// "Ask the blog" (RAG). Also login-only for now: each question costs an embedding call plus
// an LLM call. Step 4 adds per-user rate limiting.
router.post(
  '/ask',
  requireAuth,
  validate(AskBlogInputSchema),
  asyncHandler(async (req, res) => {
    const response = await askService.askBlog(req.body.question);
    res.json(response);
  }),
);

export default router;
