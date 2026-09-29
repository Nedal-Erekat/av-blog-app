import {
  CreatePostInputSchema,
  SearchPostsQuerySchema,
  UpdatePostInputSchema,
} from '@av-blog/shared';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { ValidationError } from '../errors';
import { validate } from '../middleware/validate';
import { postService } from '../services/post.service';
import { searchService } from '../services/search.service';
import { asyncHandler } from '../utils/async-handler';
import { postCommentsRouter } from './comment.routes';
import likeRoutes from './like.routes';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const authorId = typeof req.query.authorId === 'string' ? req.query.authorId : undefined;
    const categorySlug = typeof req.query.category === 'string' ? req.query.category : undefined;
    const posts = await postService.listPosts({ authorId, categorySlug });
    res.json({ posts });
  }),
);

// Must be registered before '/:slug', or "search" would be treated as a post slug.
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const parsed = SearchPostsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid search query', parsed.error.flatten().fieldErrors);
    }
    const { mode, results } = await searchService.searchPosts(parsed.data.q);
    res.json({ mode, results });
  }),
);

router.use('/:postId/comments', postCommentsRouter);
router.use('/:postId/like', likeRoutes);

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
    searchService.indexPostInBackground(post);
    res.status(201).json({ post });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(UpdatePostInputSchema),
  asyncHandler(async (req, res) => {
    const post = await postService.updatePost(req.params.id, req.userId as string, req.body);
    // Only the title and content are embedded; skip re-indexing for excerpt/category edits.
    if (req.body.title !== undefined || req.body.content !== undefined) {
      searchService.indexPostInBackground(post);
    }
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
