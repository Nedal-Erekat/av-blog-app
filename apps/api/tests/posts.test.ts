import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const createdEmails: string[] = [];

function uniqueEmail(): string {
  const email = `posts-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  createdEmails.push(email);
  return email;
}

async function registerAgent(name = 'Post Author') {
  const agent = request.agent(app);
  const email = uniqueEmail();
  await agent.post('/api/auth/register').send({ email, password: 'password123', name });
  return agent;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('GET /api/posts', () => {
  it('lists posts publicly', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  it('defaults to page 1 of 10 and reports total counts', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(res.body.posts.length).toBeLessThanOrEqual(10);
    expect(res.body.pagination).toEqual(
      expect.objectContaining({ page: 1, limit: 10, total: expect.any(Number), totalPages: expect.any(Number) }),
    );
  });

  it('paginates by authorId without returning posts from other authors', async () => {
    const agent = await registerAgent();
    const created = [];
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await agent.post('/api/posts').send({ title: `Page Post ${i}`, content: 'Body.' });
      created.push(res.body.post);
    }
    const authorId = created[0].authorId;

    const page1 = await request(app).get(`/api/posts?authorId=${authorId}&limit=2&page=1`);
    const page2 = await request(app).get(`/api/posts?authorId=${authorId}&limit=2&page=2`);

    expect(page1.body.posts).toHaveLength(2);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(page2.body.posts).toHaveLength(1);
    expect(page2.body.pagination.page).toBe(2);

    const ids = [...page1.body.posts, ...page2.body.posts].map((p: { id: string }) => p.id);
    expect(new Set(ids).size).toBe(3);

    await Promise.all(created.map((post) => agent.delete(`/api/posts/${post.id}`)));
  });

  it('clamps an oversized limit instead of erroring', async () => {
    const res = await request(app).get('/api/posts?limit=9999');
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(50);
  });

  it('filters by authorId when provided', async () => {
    const agent = await registerAgent();
    const createRes = await agent
      .post('/api/posts')
      .send({ title: 'Filtered Post', content: 'Only mine should show up.' });
    const { post } = createRes.body;

    const res = await request(app).get(`/api/posts?authorId=${post.authorId}`);
    expect(res.status).toBe(200);
    expect(res.body.posts.every((p: { authorId: string }) => p.authorId === post.authorId)).toBe(true);
    expect(res.body.posts.some((p: { id: string }) => p.id === post.id)).toBe(true);

    await agent.delete(`/api/posts/${post.id}`);
  });
});

describe('POST /api/posts', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/posts').send({ title: 'No Auth', content: 'Should fail' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid input', async () => {
    const agent = await registerAgent();
    const res = await agent.post('/api/posts').send({ title: '', content: '' });
    expect(res.status).toBe(400);
  });
});

describe('Post CRUD lifecycle', () => {
  it('creates, reads, updates, and deletes a post for its owner', async () => {
    const agent = await registerAgent();

    const createRes = await agent
      .post('/api/posts')
      .send({ title: 'My First Post', content: 'Hello world, this is my first post.' });
    expect(createRes.status).toBe(201);
    const { post } = createRes.body;
    expect(post.slug).toBe('my-first-post');
    expect(post.excerpt).toBeTruthy();

    const detailRes = await request(app).get(`/api/posts/${post.slug}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.post.id).toBe(post.id);

    const updateRes = await agent.patch(`/api/posts/${post.id}`).send({ title: 'Updated Title' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.post.title).toBe('Updated Title');

    const deleteRes = await agent.delete(`/api/posts/${post.id}`);
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await request(app).get(`/api/posts/${post.slug}`);
    expect(afterDeleteRes.status).toBe(404);
  });

  it('blocks a non-owner from editing or deleting a post', async () => {
    const ownerAgent = await registerAgent('Owner');
    const otherAgent = await registerAgent('Other User');

    const createRes = await ownerAgent
      .post('/api/posts')
      .send({ title: 'Owned Post', content: 'Only the owner can edit this.' });
    const { post } = createRes.body;

    const updateRes = await otherAgent.patch(`/api/posts/${post.id}`).send({ title: 'Hijacked' });
    expect(updateRes.status).toBe(403);

    const deleteRes = await otherAgent.delete(`/api/posts/${post.id}`);
    expect(deleteRes.status).toBe(403);

    await ownerAgent.delete(`/api/posts/${post.id}`);
  });

  it('generates a unique slug when titles collide', async () => {
    const agent = await registerAgent();

    const first = await agent.post('/api/posts').send({ title: 'Same Title', content: 'First one.' });
    const second = await agent.post('/api/posts').send({ title: 'Same Title', content: 'Second one.' });

    expect(first.body.post.slug).toBe('same-title');
    expect(second.body.post.slug).toBe('same-title-2');

    await agent.delete(`/api/posts/${first.body.post.id}`);
    await agent.delete(`/api/posts/${second.body.post.id}`);
  });
});

describe('GET /api/posts/:slug', () => {
  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/posts/does-not-exist-xyz');
    expect(res.status).toBe(404);
  });
});
