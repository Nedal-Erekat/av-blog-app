import { createHash, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

// The whole remote-MCP story against the real app and database, driven by the official MCP
// client (the same code an AI app runs): OAuth registration → consent → token → MCP tools.

const app = createApp();
let server: Server;
let baseUrl: string;
const unique = `${Date.now()}${Math.random().toString(36).slice(2)}`;
const REDIRECT_URI = 'http://localhost:9999/callback';
const createdEmails: string[] = [];
const createdClientIds: string[] = [];

type SignedInAgent = ReturnType<typeof request.agent>;

beforeAll(async () => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  // Users cascade to their posts, grants, tokens and handoffs.
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.oAuthClient.deleteMany({ where: { id: { in: createdClientIds } } });
  await prisma.$disconnect();
  jest.restoreAllMocks();
});

async function signedInUser(name: string) {
  const agent = request.agent(app);
  const email = `mcp-${name}-${unique}@example.com`;
  createdEmails.push(email);
  await agent.post('/api/auth/register').send({ email, password: 'password123', name });
  return agent;
}

async function registerClient() {
  const res = await request(app)
    .post('/register')
    .send({
      client_name: 'Test AI App',
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  expect(res.status).toBe(201);
  createdClientIds.push(res.body.client_id);
  return res.body.client_id as string;
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

// Steps 1–3 of OAuth: the app sends the user to /authorize, the user approves on the website.
async function authorize(
  user: SignedInAgent,
  clientId: string,
  challenge: string,
  scope = 'posts:read posts:write',
) {
  const authorizeRes = await request(app).get('/authorize').query({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    scope,
  });
  expect(authorizeRes.status).toBe(302);
  const consentUrl = new URL(authorizeRes.headers.location);
  expect(consentUrl.pathname).toBe('/oauth/consent');
  const grantId = consentUrl.searchParams.get('grant')!;

  const approveRes = await user.post(`/api/oauth/grants/${grantId}/approve`);
  expect(approveRes.status).toBe(200);
  const back = new URL(approveRes.body.redirectUrl);
  expect(back.searchParams.get('state')).toBe('xyz');
  return { grantId, code: back.searchParams.get('code')! };
}

function exchangeCode(clientId: string, code: string, verifier: string) {
  return request(app).post('/token').type('form').send({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
  });
}

async function accessTokenFor(user: SignedInAgent, scope?: string) {
  const clientId = await registerClient();
  const { verifier, challenge } = pkce();
  const { code } = await authorize(user, clientId, challenge, scope);
  const res = await exchangeCode(clientId, code, verifier);
  expect(res.status).toBe(200);
  return {
    clientId,
    tokens: res.body as { access_token: string; refresh_token: string; scope: string },
  };
}

async function connect(
  accessToken: string,
  onConfirm?: (message: string) => { action: 'accept' | 'decline' | 'cancel'; content?: object },
) {
  const client = new Client(
    { name: 'test-ai-app', version: '1.0.0' },
    // Only claim elicitation support when this test plays a user who can answer.
    { capabilities: onConfirm ? { elicitation: { form: {} } } : {} },
  );
  if (onConfirm) {
    client.setRequestHandler(ElicitRequestSchema, async (req) =>
      onConfirm((req.params as { message: string }).message),
    );
  }
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  await client.connect(transport);
  return { client, transport };
}

const textOf = (result: unknown) =>
  ((result as { content: { text: string }[] }).content[0]?.text ?? '') as string;

describe('discovery', () => {
  it('advertises the protected resource and the authorization server', async () => {
    const resource = await request(app).get('/.well-known/oauth-protected-resource/mcp');
    const authServer = await request(app).get('/.well-known/oauth-authorization-server');

    expect(resource.body).toMatchObject({ scopes_supported: ['posts:read', 'posts:write'] });
    expect(authServer.body).toMatchObject({
      code_challenge_methods_supported: ['S256'],
      registration_endpoint: expect.stringMatching(/\/register$/),
    });
  });

  it('rejects /mcp without a token and points to the metadata', async () => {
    const res = await request(app).post('/mcp').send({});

    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toMatch(
      /resource_metadata=".*oauth-protected-resource\/mcp"/,
    );
  });
});

describe('OAuth', () => {
  it('shows the consent page what is being asked, and only to signed-in users', async () => {
    const user = await signedInUser('consent');
    const clientId = await registerClient();
    const authorizeRes = await request(app).get('/authorize').query({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: pkce().challenge,
      code_challenge_method: 'S256',
    });
    const grantId = new URL(authorizeRes.headers.location).searchParams.get('grant');

    expect((await request(app).get(`/api/oauth/grants/${grantId}`)).status).toBe(401);
    const res = await user.get(`/api/oauth/grants/${grantId}`);
    expect(res.body).toEqual({
      clientName: 'Test AI App',
      clientUri: null,
      redirectHost: 'localhost:9999',
      scopes: ['posts:read', 'posts:write'],
    });
  });

  it('sends the app back with access_denied when the user denies', async () => {
    const user = await signedInUser('deny');
    const clientId = await registerClient();
    const authorizeRes = await request(app).get('/authorize').query({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      code_challenge: pkce().challenge,
      code_challenge_method: 'S256',
    });
    const grantId = new URL(authorizeRes.headers.location).searchParams.get('grant');

    const res = await user.post(`/api/oauth/grants/${grantId}/deny`);

    expect(new URL(res.body.redirectUrl).searchParams.get('error')).toBe('access_denied');
    expect((await user.post(`/api/oauth/grants/${grantId}/approve`)).status).toBe(404);
  });

  it('refuses a code with the wrong PKCE verifier, and a code used twice', async () => {
    const user = await signedInUser('pkce');
    const clientId = await registerClient();
    const { verifier, challenge } = pkce();
    const { code } = await authorize(user, clientId, challenge);

    const wrong = await exchangeCode(clientId, code, pkce().verifier);
    expect(wrong.status).toBe(400);
    expect(wrong.body.error).toBe('invalid_grant');

    expect((await exchangeCode(clientId, code, verifier)).status).toBe(200);
    const reused = await exchangeCode(clientId, code, verifier);
    expect(reused.body.error).toBe('invalid_grant');
  });

  it('stores tokens only as hashes', async () => {
    const user = await signedInUser('hash');
    const { tokens } = await accessTokenFor(user);

    const stored = await prisma.oAuthToken.findMany({
      where: { tokenHash: { in: [tokens.access_token, tokens.refresh_token] } },
    });
    expect(stored).toHaveLength(0);
  });

  it('rotates refresh tokens: each works once', async () => {
    const user = await signedInUser('refresh');
    const { clientId, tokens } = await accessTokenFor(user);
    const refresh = (token: string) =>
      request(app)
        .post('/token')
        .type('form')
        .send({ grant_type: 'refresh_token', client_id: clientId, refresh_token: token });

    const first = await refresh(tokens.refresh_token);
    expect(first.status).toBe(200);
    expect(first.body.refresh_token).not.toBe(tokens.refresh_token);

    expect((await refresh(tokens.refresh_token)).body.error).toBe('invalid_grant');
  });
});

describe('MCP tools', () => {
  it('lists the read and write tools for a full-access connection, and searches posts', async () => {
    const user = await signedInUser('tools');
    const { tokens } = await accessTokenFor(user);
    const { client } = await connect(tokens.access_token);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'draft_post_with_ai',
      'find_posts',
      'get_post',
      'prepare_post',
      'publish_post',
    ]);

    // No Gemini key in tests, so search uses the keyword fallback.
    const found = await client.callTool({
      name: 'find_posts',
      arguments: { topic: 'no-such-topic-' + unique },
    });
    expect(textOf(found)).toBe('No matching posts.');
    await client.close();
  });

  it('gives a read-only connection no write tools at all', async () => {
    const user = await signedInUser('readonly');
    const { tokens } = await accessTokenFor(user, 'posts:read');
    const { client } = await connect(tokens.access_token);

    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(['find_posts', 'get_post']);
    await client.close();
  });

  it('prepare_post saves a draft that only its owner can open for review', async () => {
    const owner = await signedInUser('owner');
    const stranger = await signedInUser('stranger');
    const { tokens } = await accessTokenFor(owner);
    const { client } = await connect(tokens.access_token);

    const res = await client.callTool({
      name: 'prepare_post',
      arguments: { title: `MCP draft ${unique}`, content: 'Written by an AI app.' },
    });
    const { reviewUrl, published } = res.structuredContent as {
      reviewUrl: string;
      published: boolean;
    };
    const handoffId = new URL(reviewUrl).searchParams.get('handoff');

    expect(published).toBe(false);
    expect((await owner.get(`/api/draft-handoffs/${handoffId}`)).body.draft).toEqual({
      title: `MCP draft ${unique}`,
      content: 'Written by an AI app.',
    });
    expect((await stranger.get(`/api/draft-handoffs/${handoffId}`)).status).toBe(404);
    await client.close();
  });

  describe('publish_post always needs the human', () => {
    const post = () => ({
      title: `Published via MCP ${randomBytes(4).toString('hex')}`,
      content: 'Hello from Claude.',
    });

    it('publishes after the user confirms in their AI app (elicitation)', async () => {
      const user = await signedInUser('confirm');
      const { tokens } = await accessTokenFor(user);
      const confirmations: string[] = [];
      const { client } = await connect(tokens.access_token, (message) => {
        confirmations.push(message);
        return { action: 'accept', content: { publish: true } };
      });
      const draft = post();

      const res = await client.callTool({ name: 'publish_post', arguments: draft });

      expect(confirmations[0]).toContain(draft.title);
      expect(res.structuredContent).toMatchObject({ published: true });
      expect(await prisma.post.count({ where: { title: draft.title } })).toBe(1);
      await client.close();
    });

    it('publishes nothing when the user declines', async () => {
      const user = await signedInUser('decline');
      const { tokens } = await accessTokenFor(user);
      const { client } = await connect(tokens.access_token, () => ({ action: 'decline' }));
      const draft = post();

      const res = await client.callTool({ name: 'publish_post', arguments: draft });

      expect(textOf(res)).toMatch(/Nothing was published/);
      expect(await prisma.post.count({ where: { title: draft.title } })).toBe(0);
      await client.close();
    });

    it('returns a review link instead when the app cannot ask the user', async () => {
      const user = await signedInUser('noelicit');
      const { tokens } = await accessTokenFor(user);
      const { client } = await connect(tokens.access_token);
      const draft = post();

      const res = await client.callTool({ name: 'publish_post', arguments: draft });

      expect(res.structuredContent).toMatchObject({
        published: false,
        reviewUrl: expect.stringMatching(/\/posts\/new\?handoff=/),
      });
      expect(await prisma.post.count({ where: { title: draft.title } })).toBe(0);
      await client.close();
    });
  });

  it("refuses to use another user's session, even with a valid token", async () => {
    const alice = await signedInUser('alice');
    const bob = await signedInUser('bob');
    const { tokens: aliceTokens } = await accessTokenFor(alice);
    const { tokens: bobTokens } = await accessTokenFor(bob);
    const { client, transport } = await connect(aliceTokens.access_token);

    const res = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${bobTokens.access_token}`)
      .set('Mcp-Session-Id', transport.sessionId!)
      .set('Accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

    expect(res.status).toBe(404);
    await client.close();
  });

  it('rejects a revoked token', async () => {
    const user = await signedInUser('revoke');
    const { clientId, tokens } = await accessTokenFor(user);

    await request(app)
      .post('/revoke')
      .type('form')
      .send({ token: tokens.access_token, client_id: clientId });

    const res = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .send({});
    expect(res.status).toBe(401);
  });
});
