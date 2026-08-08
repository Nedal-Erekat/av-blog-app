import { Router } from 'express';
import { categoryRepository } from '../repositories/category.repository';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categories = await categoryRepository.findAll();
    res.json({ categories });
  }),
);

export default router;
