import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { NotFoundError } from '../errors';
import { prisma } from '../lib/prisma';
import { hashSecret, newSecret } from './oauth-provider';

// The website's consent page: "<App> wants to access your blog. Approve / Deny".
// Approving ties the grant to the signed-in user and creates the one-time code.

async function findPendingGrant(grantId: string) {
  const grant = await prisma.oAuthGrant.findUnique({
    where: { id: grantId },
    include: { client: true },
  });
  if (!grant || grant.status !== 'pending' || grant.expiresAt < new Date()) {
    throw new NotFoundError(
      'This authorization request is invalid or has expired. Start again from your AI app.',
    );
  }
  return grant;
}

function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.href;
}

export const consentService = {
  async describe(grantId: string) {
    const grant = await findPendingGrant(grantId);
    const client = grant.client.metadata as unknown as OAuthClientInformationFull;
    return {
      clientName: client.client_name ?? 'An unnamed app',
      clientUri: client.client_uri ?? null,
      // Showing where the user will be sent back helps them spot a look-alike app.
      redirectHost: new URL(grant.redirectUri).host,
      scopes: grant.scopes,
    };
  },

  async approve(grantId: string, userId: string): Promise<{ redirectUrl: string }> {
    const grant = await findPendingGrant(grantId);
    const code = newSecret();
    // Only succeeds if still pending: approving twice (or racing a deny) can't mint two codes.
    const { count } = await prisma.oAuthGrant.updateMany({
      where: { id: grant.id, status: 'pending' },
      data: { status: 'approved', userId, codeHash: hashSecret(code) },
    });
    if (count !== 1) throw new NotFoundError('This authorization request was already handled');
    return { redirectUrl: redirectWith(grant.redirectUri, { code, state: grant.state }) };
  },

  async deny(grantId: string): Promise<{ redirectUrl: string }> {
    const grant = await findPendingGrant(grantId);
    await prisma.oAuthGrant.update({ where: { id: grant.id }, data: { status: 'denied' } });
    return {
      redirectUrl: redirectWith(grant.redirectUri, {
        error: 'access_denied',
        error_description: 'The user denied access',
        state: grant.state,
      }),
    };
  },
};
