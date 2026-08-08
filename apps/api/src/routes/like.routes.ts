import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { likeService } from '../services/like.service';
import { asyncHandler } from '../utils/async-handler';

// Mounted at /api/posts/:postId/like (mergeParams to read :postId from the parent router).
const router = Router({ mergeParams: true });

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const status = await likeService.getStatus(req.params.postId, req.userId as string);
    res.json(status);
  }),
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await likeService.toggle(req.params.postId, req.userId as string);
    res.json(result);
  }),
);

export default router;
