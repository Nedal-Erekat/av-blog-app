'use client';

import {
  AgentDraftInputSchema,
  type AgentDraftResponse,
  type CreatePostInput,
} from '@av-blog/shared';
import { useState, type FormEvent } from 'react';
import { ApiError, apiClient } from '@/lib/api-client';

// The writing assistant: describe a post, the agent researches the blog and proposes a draft,
// and the draft lands in the normal post form for YOU to review, edit and publish.
export function AgentDraftPanel({ onDraft }: { onDraft: (draft: CreatePostInput) => void }) {
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<AgentDraftResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = AgentDraftInputSchema.safeParse({ instruction });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid request');
      return;
    }

    setWorking(true);
    setResult(null);
    try {
      const response = await apiClient.post<AgentDraftResponse>('/api/ai/agent/draft', parsed.data);
      setResult(response);
      if (response.draft) onDraft(response.draft);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      aria-label="Writing assistant"
      className="rounded border border-indigo-200 bg-indigo-50 p-4"
    >
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="instruction" className="block text-sm font-medium">
          ✨ Writing assistant: describe the post you want
        </label>
        <textarea
          id="instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={2}
          placeholder="e.g. A follow-up to our Postgres post: what we learned after one year"
          className="w-full rounded border border-gray-300 bg-white px-3 py-2"
        />
        <button
          type="submit"
          disabled={working}
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {working ? 'Researching and drafting...' : 'Draft it for me'}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-3 text-sm">
          <p className="font-medium">{result.message}</p>
          {/* Show every step the agent took: an agent you can't inspect is one you can't trust. */}
          {result.steps.length > 0 && (
            <ol aria-label="Assistant steps" className="mt-2 list-decimal pl-5 text-gray-600">
              {result.steps.map((step, i) => (
                <li key={i} className={step.ok ? '' : 'text-amber-700'}>
                  {step.summary}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
