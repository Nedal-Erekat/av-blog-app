'use client';

import {
  CreatePostInputSchema,
  SummarizePostInputSchema,
  type CreatePostInput,
  type PostSuggestion,
} from '@av-blog/shared';
import { useState, type FormEvent } from 'react';
import { ApiError, apiClient } from '@/lib/api-client';

type PostFormValues = {
  title: string;
  content: string;
  excerpt: string;
  category: string;
};

type PostFormProps = {
  initialValues?: PostFormValues;
  submitLabel: string;
  onSubmit: (input: CreatePostInput) => Promise<void>;
};

export function PostForm({ initialValues, submitLabel, onSubmit }: PostFormProps) {
  const [form, setForm] = useState<PostFormValues>(
    initialValues ?? { title: '', content: '', excerpt: '', category: '' },
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Asks the API (never the model directly: the key lives server-side) to fill excerpt and category.
  async function handleSuggest() {
    setError(null);

    const result = SummarizePostInputSchema.safeParse({ title: form.title, content: form.content });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setSuggesting(true);
    try {
      const { suggestion } = await apiClient.post<{ suggestion: PostSuggestion }>(
        '/api/ai/summarize',
        result.data,
      );
      // Pre-fill only: the author reviews and can edit before publishing.
      setForm((current) => ({
        ...current,
        excerpt: suggestion.excerpt,
        category: suggestion.category,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSuggesting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result = CreatePostInputSchema.safeParse({
      title: form.title,
      content: form.content,
      excerpt: form.excerpt.trim() ? form.excerpt : undefined,
      category: form.category.trim() ? form.category : undefined,
    });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>
      <div>
        <label htmlFor="excerpt" className="block text-sm font-medium">
          Excerpt (optional)
        </label>
        <input
          id="excerpt"
          type="text"
          value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-medium">
          Category (optional)
        </label>
        <input
          id="category"
          type="text"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          placeholder="e.g. Engineering"
        />
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium">
          Content
        </label>
        <textarea
          id="content"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          rows={10}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || suggesting}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={submitting || suggesting}
          className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
        >
          {suggesting ? 'Thinking...' : '✨ Suggest excerpt & category'}
        </button>
      </div>
    </form>
  );
}
