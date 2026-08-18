import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const createdEmails: string[] = [];

function uniqueEmail(): string {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  createdEmails.push(email);
  return email;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a new user, sets a session cookie, and never returns the password hash', async () => {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, name: 'Test User' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
  });

  it('rejects a duplicate email with 409', async () => {
    const email = uniqueEmail();
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Test User' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Test User' });

    expect(res.status).toBe(409);
  });

  it('rejects invalid input with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '123', name: '' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const email = uniqueEmail();
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Test User' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=/);
  });

  it('rejects an unknown email with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail(), password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('rejects a wrong password with 401', async () => {
    const email = uniqueEmail();
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', name: 'Test User' });

    const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without a session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid session', async () => {
    const email = uniqueEmail();
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ email, password: 'password123', name: 'Test User' });

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });
});

describe('Rate limiting on /api/auth/login', () => {
  it('allows 10 attempts for one IP + email pair, then returns 429', async () => {
    const email = uniqueEmail();
    const statuses: number[] = [];

    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/api/auth/login').send({ email, password: 'wrong-password' });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });

  it('scopes the limit per email, not just per IP', async () => {
    // Same test process, so same source IP as the test above — a fresh email
    // must still get a normal response instead of inheriting the 429.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail(), password: 'wrong-password' });
    expect(res.status).toBe(401);
  });
});

describe('Rate limiting on /api/auth/register', () => {
  it('returns 429 after exceeding the attempt limit for one IP + email pair', async () => {
    const email = uniqueEmail();
    const statuses: number[] = [];

    for (let i = 0; i < 11; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email, password: 'password123', name: 'Test User' });
      statuses.push(res.status);
    }

    expect(statuses[0]).toBe(201);
    expect(statuses.slice(1, 10)).toEqual(Array(9).fill(409));
    expect(statuses[10]).toBe(429);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears the session cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']?.[0]).toMatch(/token=;/);
  });
});
