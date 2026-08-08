import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler } from './middleware/error-handler';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import { commentsRouter } from './routes/comment.routes';
import postRoutes from './routes/post.routes';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'error', db: 'unreachable' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/comments', commentsRouter);
  app.use('/api/categories', categoryRoutes);

  app.use(errorHandler);

  return app;
}
