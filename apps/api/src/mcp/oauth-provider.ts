import { createHash, randomBytes } from 'node:crypto';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  InvalidGrantError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { Response } from 'express';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

// OAuth 2.1 for the MCP server, in plain words:
// 1. An AI app (Claude, ChatGPT, …) registers itself and gets a client_id.
// 2. It sends the user's browser to /authorize. We save a pending "grant" and send the user to a
//    consent page on the website, where they sign in and click Approve or Deny.
// 3. On Approve the browser returns to the app with a one-time CODE. The app swaps the code
//    (plus its PKCE secret) for an ACCESS token (1 hour) and a REFRESH token (30 days).
// 4. The app calls /mcp with "Authorization: Bearer <access token>".
//
// The MCP SDK handles the HTTP endpoints and protocol checks (including PKCE); this class is
// the storage and the rules. Every secret (codes, tokens) is stored only as a SHA-256 hash.

export const SCOPES = {
  read: 'posts:read',
  write: 'posts:write',
} as const;
export const SUPPORTED_SCOPES = [SCOPES.read, SCOPES.write];

const GRANT_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_S = 60 * 60;
const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60;

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId) {
    const client = await prisma.oAuthClient.findUnique({ where: { id: clientId } });
    return client ? (client.metadata as unknown as OAuthClientInformationFull) : undefined;
  },
  // Dynamic client registration: any app may register, but registering grants nothing on its
  // own. Access only comes from a user approving it on the consent page.
  async registerClient(client) {
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: `mcp_${randomBytes(12).toString('hex')}`,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    await prisma.oAuthClient.create({
      data: { id: full.client_id, metadata: full as unknown as object },
    });
    return full;
  },
};

async function issueTokens(
  clientId: string,
  userId: string,
  scopes: string[],
  resource: string | null,
): Promise<OAuthTokens> {
  const accessToken = newSecret();
  const refreshToken = newSecret();
  const now = Date.now();
  await prisma.oAuthToken.createMany({
    data: [
      {
        tokenHash: hashSecret(accessToken),
        kind: 'access',
        clientId,
        userId,
        scopes,
        resource,
        expiresAt: new Date(now + ACCESS_TOKEN_TTL_S * 1000),
      },
      {
        tokenHash: hashSecret(refreshToken),
        kind: 'refresh',
        clientId,
        userId,
        scopes,
        resource,
        expiresAt: new Date(now + REFRESH_TOKEN_TTL_S * 1000),
      },
    ],
  });
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  };
}

export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  // Step 2: remember the request, then send the user to the consent page on the website.
  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response) {
    const requested = (params.scopes ?? []).filter((scope) =>
      SUPPORTED_SCOPES.includes(scope as never),
    );
    const grant = await prisma.oAuthGrant.create({
      data: {
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        state: params.state ?? null,
        scopes: requested.length > 0 ? requested : SUPPORTED_SCOPES,
        resource: params.resource?.href ?? null,
        expiresAt: new Date(Date.now() + GRANT_TTL_MS),
      },
    });
    res.redirect(302, `${env.FRONTEND_URL}/oauth/consent?grant=${grant.id}`);
  },

  async challengeForAuthorizationCode(client, authorizationCode) {
    const grant = await prisma.oAuthGrant.findUnique({
      where: { codeHash: hashSecret(authorizationCode) },
    });
    if (!grant || grant.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code');
    }
    return grant.codeChallenge;
  },

  // Step 3: a code works once, for the app it was issued to, before it expires. (The SDK has
  // already checked the PKCE verifier against challengeForAuthorizationCode.)
  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri) {
    const grant = await prisma.oAuthGrant.findUnique({
      where: { codeHash: hashSecret(authorizationCode) },
    });
    if (
      !grant ||
      grant.clientId !== client.client_id ||
      grant.status !== 'approved' ||
      !grant.userId ||
      grant.expiresAt < new Date() ||
      (redirectUri !== undefined && redirectUri !== grant.redirectUri)
    ) {
      throw new InvalidGrantError('Invalid or expired authorization code');
    }
    // Mark it used in the same statement that checks it's unused, so two parallel
    // exchanges can't both succeed.
    const { count } = await prisma.oAuthGrant.updateMany({
      where: { id: grant.id, status: 'approved' },
      data: { status: 'used' },
    });
    if (count !== 1) throw new InvalidGrantError('Authorization code already used');

    return issueTokens(client.client_id, grant.userId, grant.scopes, grant.resource);
  },

  // Refresh tokens ROTATE: each one works once and is replaced, so a stolen old one is useless.
  async exchangeRefreshToken(client, refreshToken, scopes) {
    const stored = await prisma.oAuthToken.findUnique({
      where: { tokenHash: hashSecret(refreshToken) },
    });
    if (
      !stored ||
      stored.kind !== 'refresh' ||
      stored.clientId !== client.client_id ||
      stored.revokedAt ||
      stored.expiresAt < new Date()
    ) {
      throw new InvalidGrantError('Invalid or expired refresh token');
    }
    // A refresh may narrow the scopes, never widen them.
    const narrowed = scopes?.length
      ? scopes.filter((s) => stored.scopes.includes(s))
      : stored.scopes;

    const { count } = await prisma.oAuthToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count !== 1) throw new InvalidGrantError('Refresh token already used');

    return issueTokens(client.client_id, stored.userId, narrowed, stored.resource);
  },

  // Step 4: every /mcp request. The user id travels in `extra` to the tool handlers.
  async verifyAccessToken(token): Promise<AuthInfo> {
    const stored = await prisma.oAuthToken.findUnique({ where: { tokenHash: hashSecret(token) } });
    if (!stored || stored.kind !== 'access' || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new InvalidTokenError('Invalid or expired access token');
    }
    return {
      token,
      clientId: stored.clientId,
      scopes: stored.scopes,
      expiresAt: Math.floor(stored.expiresAt.getTime() / 1000),
      resource: stored.resource ? new URL(stored.resource) : undefined,
      extra: { userId: stored.userId },
    };
  },

  async revokeToken(client, request: OAuthTokenRevocationRequest) {
    await prisma.oAuthToken.updateMany({
      where: { tokenHash: hashSecret(request.token), clientId: client.client_id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
