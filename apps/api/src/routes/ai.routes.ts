import {
  AgentDraftInputSchema,
  AskBlogInputSchema,
  CommandInputSchema,
  SummarizePostInputSchema,
} from '@av-blog/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { rateLimitPerUser } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { aiService } from '../services/ai.service';
import { askService } from '../services/ask.service';
import { commandService } from '../services/command.service';
import { draftAgent } from '../services/draft-agent.service';
import { asyncHandler } from '../utils/async-handler';
import { createRateLimiter } from '../utils/rate-limiter';

const router = Router();

// Cost control: every AI request spends free-tier quota (or, on a paid plan, money). These caps
// stop one user, or one leaked session cookie, from burning through it for everyone.
const HOUR_MS = 60 * 60 * 1000;
const summarizeLimiter = createRateLimiter({ limit: 20, windowMs: HOUR_MS });
const askLimiter = createRateLimiter({ limit: 20, windowMs: HOUR_MS });
// Lower: one agent run can make up to 8 model calls plus several searches.
const agentLimiter = createRateLimiter({ limit: 10, windowMs: HOUR_MS });
// Higher: interpreting a command is a single, small model call.
const commandLimiter = createRateLimiter({ limit: 60, windowMs: HOUR_MS });

// Logged-in users only: every call costs model quota, so anonymous access would be abuse-prone.
router.post(
  '/summarize',
  requireAuth,
  validate(SummarizePostInputSchema),
  // After validation: invalid requests never reach the model, so they shouldn't use up quota.
  rateLimitPerUser(summarizeLimiter),
  asyncHandler(async (req, res) => {
    const suggestion = await aiService.suggestPostMetadata(req.body);
    res.json({ suggestion });
  }),
);

// "Ask the blog" (RAG). Login-only and rate limited: each question costs an embedding call
// plus an LLM call.
router.post(
  '/ask',
  requireAuth,
  validate(AskBlogInputSchema),
  rateLimitPerUser(askLimiter),
  asyncHandler(async (req, res) => {
    const response = await askService.askBlog(req.body.question);
    res.json(response);
  }),
);

// The writing assistant agent. It only PROPOSES a draft; the author reviews and publishes it
// through the normal post form, so a human is always in the loop.
router.post(
  '/agent/draft',
  requireAuth,
  validate(AgentDraftInputSchema),
  rateLimitPerUser(agentLimiter),
  asyncHandler(async (req, res) => {
    const response = await draftAgent.draftPost(req.body.instruction);
    res.json(response);
  }),
);

// The command bar: free text in, one validated action out. The API only CHOOSES the action;
// the browser runs it as the signed-in user (and asks before publishing).
router.post(
  '/command',
  requireAuth,
  validate(CommandInputSchema),
  rateLimitPerUser(commandLimiter),
  asyncHandler(async (req, res) => {
    const response = await commandService.interpret(req.body.text);
    res.json(response);
  }),
);

export default router;
