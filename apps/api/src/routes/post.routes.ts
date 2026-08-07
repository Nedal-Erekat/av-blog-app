import { CreatePostInputSchema, UpdatePostInputSchema } from '@av-blog/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { postService } from '../services/post.service';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const posts = await postService.listPosts();
    res.json({ posts });
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const post = await postService.getPostBySlug(req.params.slug);
    res.json({ post });
  }),
);

router.post(
  '/',
  requireAuth,
  validate(CreatePostInputSchema),
  asyncHandler(async (req, res) => {
    const post = await postService.createPost(req.userId as string, req.body);
    res.status(201).json({ post });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(UpdatePostInputSchema),
  asyncHandler(async (req, res) => {
    const post = await postService.updatePost(req.params.id, req.userId as string, req.body);
    res.json({ post });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await postService.deletePost(req.params.id, req.userId as string);
    res.status(204).send();
  }),
);

export default router;
