'use client';

import { useState } from 'react';
import { ApiError, apiClient } from '@/lib/api-client';
import type { OAuthGrantInfo } from '@/lib/types';

const SCOPE_TEXT: Record<string, string> = {
  'posts:read': 'Search and read posts',
  'posts:write':
    'Write drafts and publish posts as you (you are asked to confirm before anything is published)',
};

export function OAuthConsentForm({
  grantId,
  grant,
  redirect = (url) => window.location.assign(url),
}: {
  grantId: string;
  grant: OAuthGrantInfo;
  // Injectable for tests; leaving the site is a full-page navigation.
  redirect?: (url: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function answer(decision: 'approve' | 'deny') {
    setError(null);
    setWorking(true);
    try {
      const { redirectUrl } = await apiClient.post<{ redirectUrl: string }>(
        `/api/oauth/grants/${encodeURIComponent(grantId)}/${decision}`,
      );
      // Back to the AI app, carrying the one-time code (or the "denied" answer).
      redirect(redirectUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setWorking(false);
    }
  }

  return (
    <section aria-label="Connect an app">
      <h1 className="text-2xl font-bold">
        {grant.clientName} wants to access your Avertra Blog account
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        After you answer, you&apos;ll return to <strong>{grant.redirectHost}</strong>. Only continue
        if you started this from an app you trust.
      </p>

      <h2 className="mt-6 text-sm font-medium">It will be able to:</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {grant.scopes.map((scope) => (
          <li key={scope}>{SCOPE_TEXT[scope] ?? scope}</li>
        ))}
      </ul>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 flex gap-2">
        <button
          type="button"
          disabled={working}
          onClick={() => answer('approve')}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => answer('deny')}
          className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </section>
  );
}
