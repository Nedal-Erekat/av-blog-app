import { CreateCommentInputSchema } from '@av-blog/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { commentService } from '../services/comment.service';
import { asyncHandler } from '../utils/async-handler';

// Mounted at /api/posts/:postId/comments (mergeParams to read :postId from the parent router).
export const postCommentsRouter = Router({ mergeParams: true });

postCommentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const comments = await commentService.listComments(req.params.postId);
    res.json({ comments });
  }),
);

postCommentsRouter.post(
  '/',
  requireAuth,
  validate(CreateCommentInputSchema),
  asyncHandler(async (req, res) => {
    const comment = await commentService.addComment(req.params.postId, req.userId as string, req.body.content);
    res.status(201).json({ comment });
  }),
);

// Mounted at /api/comments — deleting a comment doesn't need its parent post in the URL.
export const commentsRouter = Router();

commentsRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await commentService.deleteComment(req.params.id, req.userId as string);
    res.status(204).send();
  }),
);
