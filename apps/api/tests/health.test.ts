import request from 'supertest';
import { createApp } from '../src/app';
import { closeDb } from '../src/db';

// The health check opens a connection on the shared pool. postgres.js keeps its
// sockets open until told otherwise, so without this the Jest process never exits.
afterAll(async () => {
  await closeDb();
});

describe('GET /api/health', () => {
  it('returns ok status with DB connectivity confirmed', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'connected' });
  });
});
