'use client';

import { AskBlogInputSchema, type AskBlogResponse } from '@av-blog/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ApiError, apiClient } from '@/lib/api-client';

export function AskBlog() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AskBlogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result = AskBlogInputSchema.safeParse({ question });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid question');
      return;
    }

    setAsking(true);
    setResponse(null);
    try {
      setResponse(await apiClient.post<AskBlogResponse>('/api/ai/ask', result.data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setAsking(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="question" className="block text-sm font-medium">
          Your question
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="e.g. Why did the team choose Postgres?"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={asking}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {asking ? 'Reading the blog...' : 'Ask'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {response && (
        <section aria-label="Answer" className="mt-8 rounded border border-gray-200 p-4">
          <p className="whitespace-pre-line">{response.answer}</p>
          {response.sources.length > 0 && (
            <div className="mt-4">
              <h2 className="text-sm font-medium text-gray-500">Sources</h2>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {response.sources.map((source) => (
                  <li key={source.postId}>
                    <Link
                      href={`/posts/${source.slug}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {source.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* AI answers can be wrong even when grounded; say so, and point to the sources. */}
          <p className="mt-4 text-xs text-gray-400">
            AI-generated from blog posts. Check the sources for details.
          </p>
        </section>
      )}
    </div>
  );
}
