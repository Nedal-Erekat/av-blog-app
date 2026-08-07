import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /api/health', () => {
  it('returns ok status with DB connectivity confirmed', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'connected' });
  });
});
