import { randomUUID } from 'node:crypto';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import cors from 'cors';
import { Router, type Request, type Response } from 'express';
import { env } from '../config/env';
import { createBlogMcpServer } from './blog-mcp-server';
import { oauthProvider, SUPPORTED_SCOPES } from './oauth-provider';

// Everything an MCP client needs, mounted at the API root:
//   /.well-known/oauth-protected-resource/mcp   "this server is protected; here is its auth server"
//   /.well-known/oauth-authorization-server     "here are my /authorize /token /register endpoints"
//   /authorize /token /register /revoke         OAuth 2.1 (from the SDK, backed by oauth-provider.ts)
//   /mcp                                        the MCP endpoint itself (Bearer token required)

const SESSION_IDLE_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 1000;

type Session = {
  transport: StreamableHTTPServerTransport;
  userId: string;
  lastSeen: number;
};

export function createMcpRouter(): Router {
  const router = Router();
  const mcpUrl = new URL('/mcp', env.PUBLIC_API_URL);

  router.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl: new URL(env.PUBLIC_API_URL),
      resourceServerUrl: mcpUrl,
      scopesSupported: SUPPORTED_SCOPES,
      resourceName: 'Avertra Blog',
    }),
  );

  // Sessions live in this process's memory: fine for one server instance. (With several, you'd
  // need sticky routing or a shared store, the same trade-off as the rate limiter.)
  const sessions = new Map<string, Session>();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      // Closing the transport triggers onclose, which removes the session from the map.
      if (now - session.lastSeen > SESSION_IDLE_MS) void session.transport.close();
    }
  }, 60_000);
  sweeper.unref();

  // MCP clients authenticate with a Bearer token, never cookies, so allowing any origin is safe
  // here (unlike the cookie-based website API).
  router.use(
    '/mcp',
    cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id', 'WWW-Authenticate'] }),
    requireBearerAuth({
      verifier: oauthProvider,
      // Tells a client with no/expired token where to start the OAuth flow.
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
    }),
  );

  function sessionFor(req: Request, res: Response): Session | undefined {
    const id = req.header('mcp-session-id');
    const session = id ? sessions.get(id) : undefined;
    // A session belongs to the user who opened it. Someone else's token with a stolen session
    // id gets the same answer as a made-up id.
    if (!session || session.userId !== req.auth?.extra?.userId) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
      return undefined;
    }
    session.lastSeen = Date.now();
    return session;
  }

  router.post('/mcp', async (req, res) => {
    if (req.header('mcp-session-id')) {
      const session = sessionFor(req, res);
      if (session) await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Start with an initialize request (no session yet)' },
        id: null,
      });
      return;
    }
    if (sessions.size >= MAX_SESSIONS) {
      res.status(503).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Too many open sessions, try again later' },
        id: null,
      });
      return;
    }

    const auth = req.auth!;
    const userId = auth.extra?.userId as string;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { transport, userId, lastSeen: Date.now() });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    const server = createBlogMcpServer({ userId, scopes: auth.scopes });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // GET opens a stream for server-to-client messages; DELETE ends the session.
  const handleSessionRequest = async (req: Request, res: Response) => {
    const session = sessionFor(req, res);
    if (session) await session.transport.handleRequest(req, res);
  };
  router.get('/mcp', handleSessionRequest);
  router.delete('/mcp', handleSessionRequest);

  return router;
}
