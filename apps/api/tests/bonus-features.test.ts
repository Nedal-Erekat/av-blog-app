import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const createdEmails: string[] = [];
const createdCategoryNames: string[] = [];

function uniqueEmail(): string {
  const email = `bonus-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  createdEmails.push(email);
  return email;
}

function uniqueCategoryName(): string {
  const name = `Bonus Category ${Date.now()}-${Math.random().toString(36).slice(2)}`;
  createdCategoryNames.push(name);
  return name;
}

async function registerAgent(name = 'Bonus Tester') {
  const agent = request.agent(app);
  const email = uniqueEmail();
  await agent.post('/api/auth/register').send({ email, password: 'password123', name });
  return agent;
}

afterAll(async () => {
  await prisma.category.deleteMany({ where: { name: { in: createdCategoryNames } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe('Categories', () => {
  it('creates a category when a post specifies one, and lists it', async () => {
    const agent = await registerAgent();
    const categoryName = uniqueCategoryName();

    const createRes = await agent
      .post('/api/posts')
      .send({ title: 'Categorized Post', content: 'Has a category.', category: categoryName });
    expect(createRes.status).toBe(201);
    expect(createRes.body.post.category.name).toBe(categoryName);

    const listRes = await request(app).get('/api/categories');
    expect(listRes.status).toBe(200);
    expect(listRes.body.categories.some((c: { name: string }) => c.name === categoryName)).toBe(true);

    await agent.delete(`/api/posts/${createRes.body.post.id}`);
  });

  it('reuses an existing category instead of duplicating it', async () => {
    const agent = await registerAgent();
    const categoryName = uniqueCategoryName();

    const first = await agent
      .post('/api/posts')
      .send({ title: 'First Post', content: 'First.', category: categoryName });
    const second = await agent
      .post('/api/posts')
      .send({ title: 'Second Post', content: 'Second.', category: categoryName });

    expect(first.body.post.category.id).toBe(second.body.post.category.id);

    const listRes = await request(app).get('/api/categories');
    const matches = listRes.body.categories.filter((c: { name: string }) => c.name === categoryName);
    expect(matches).toHaveLength(1);

    await agent.delete(`/api/posts/${first.body.post.id}`);
    await agent.delete(`/api/posts/${second.body.post.id}`);
  });

  it('filters the post list by category slug', async () => {
    const agent = await registerAgent();
    const categoryName = uniqueCategoryName();

    const createRes = await agent
      .post('/api/posts')
      .send({ title: 'Filterable Post', content: 'Filter me.', category: categoryName });
    const { post } = createRes.body;

    const filteredRes = await request(app).get(`/api/posts?category=${post.category.slug}`);
    expect(filteredRes.status).toBe(200);
    expect(
      filteredRes.body.posts.every(
        (p: { category: { slug: string } | null }) => p.category?.slug === post.category.slug,
      ),
    ).toBe(true);
    expect(filteredRes.body.posts.some((p: { id: string }) => p.id === post.id)).toBe(true);

    await agent.delete(`/api/posts/${post.id}`);
  });
});

describe('Comments', () => {
  it('requires auth to post a comment', async () => {
    const agent = await registerAgent();
    const createRes = await agent.post('/api/posts').send({ title: 'Comment Target', content: 'Comment on me.' });
    const { post } = createRes.body;

    const res = await request(app).post(`/api/posts/${post.id}/comments`).send({ content: 'No auth' });
    expect(res.status).toBe(401);

    await agent.delete(`/api/posts/${post.id}`);
  });

  it('adds and lists comments, and blocks deleting a comment you do not own', async () => {
    const [ownerAgent, commenterAgent] = await Promise.all([
      registerAgent('Post Owner'),
      registerAgent('Commenter'),
    ]);

    const createRes = await ownerAgent.post('/api/posts').send({ title: 'Discuss This', content: 'Body.' });
    const { post } = createRes.body;

    const commentRes = await commenterAgent.post(`/api/posts/${post.id}/comments`).send({ content: 'Nice post!' });
    expect(commentRes.status).toBe(201);
    expect(commentRes.body.comment.content).toBe('Nice post!');

    const listRes = await request(app).get(`/api/posts/${post.id}/comments`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.comments).toHaveLength(1);

    const wrongDeleteRes = await ownerAgent.delete(`/api/comments/${commentRes.body.comment.id}`);
    expect(wrongDeleteRes.status).toBe(403);

    const rightDeleteRes = await commenterAgent.delete(`/api/comments/${commentRes.body.comment.id}`);
    expect(rightDeleteRes.status).toBe(204);

    await ownerAgent.delete(`/api/posts/${post.id}`);
  });
});

describe('Likes', () => {
  it('requires auth to view status or toggle', async () => {
    const agent = await registerAgent();
    const createRes = await agent.post('/api/posts').send({ title: 'Likeable Post', content: 'Like me.' });
    const { post } = createRes.body;

    const statusRes = await request(app).get(`/api/posts/${post.id}/like`);
    expect(statusRes.status).toBe(401);

    const toggleRes = await request(app).post(`/api/posts/${post.id}/like`);
    expect(toggleRes.status).toBe(401);

    await agent.delete(`/api/posts/${post.id}`);
  });

  it('toggles a like on and off, updating the count', async () => {
    const [ownerAgent, likerAgent] = await Promise.all([
      registerAgent('Post Owner'),
      registerAgent('Liker'),
    ]);

    const createRes = await ownerAgent.post('/api/posts').send({ title: 'Popular Post', content: 'Like this.' });
    const { post } = createRes.body;

    const likeRes = await likerAgent.post(`/api/posts/${post.id}/like`);
    expect(likeRes.status).toBe(200);
    expect(likeRes.body).toEqual({ liked: true, likeCount: 1 });

    const statusRes = await likerAgent.get(`/api/posts/${post.id}/like`);
    expect(statusRes.body.liked).toBe(true);

    const unlikeRes = await likerAgent.post(`/api/posts/${post.id}/like`);
    expect(unlikeRes.status).toBe(200);
    expect(unlikeRes.body).toEqual({ liked: false, likeCount: 0 });

    await ownerAgent.delete(`/api/posts/${post.id}`);
  });
});
