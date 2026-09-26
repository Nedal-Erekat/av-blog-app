import { CreatePostInputSchema, type CreatePostInput } from '@av-blog/shared';
import { env } from '../config/env';
import { NotFoundError } from '../errors';
import { prisma } from '../lib/prisma';

// Human in the loop for AI apps outside the browser: instead of publishing, the MCP server can
// save a draft and hand back a link. Only the owner can open it, and it expires.
const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

export const draftHandoffService = {
  async create(userId: string, draft: CreatePostInput): Promise<{ id: string; reviewUrl: string }> {
    const handoff = await prisma.draftHandoff.create({
      data: { userId, draft, expiresAt: new Date(Date.now() + HANDOFF_TTL_MS) },
    });
    return { id: handoff.id, reviewUrl: `${env.FRONTEND_URL}/posts/new?handoff=${handoff.id}` };
  },

  async get(id: string, userId: string): Promise<CreatePostInput> {
    const handoff = await prisma.draftHandoff.findUnique({ where: { id } });
    // Someone else's draft looks exactly like a missing one: don't reveal that it exists.
    if (!handoff || handoff.userId !== userId || handoff.expiresAt < new Date()) {
      throw new NotFoundError('Draft not found or expired');
    }
    return CreatePostInputSchema.parse(handoff.draft);
  },
};
