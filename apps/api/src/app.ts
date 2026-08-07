import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
