'use client';

import { CreateCommentInputSchema } from '@av-blog/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Comment } from '@/lib/types';

export function CommentSection({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ comments: Comment[] }>(`/api/posts/${postId}/comments`)
      .then((res) => setComments(res.comments));
  }, [postId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result = CreateCommentInputSchema.safeParse({ content });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? 'Invalid comment');
      return;
    }

    setSubmitting(true);
    try {
      const { comment } = await apiClient.post<{ comment: Comment }>(
        `/api/posts/${postId}/comments`,
        result.data,
      );
      setComments((prev) => (prev ? [...prev, comment] : [comment]));
      setContent('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Delete this comment?')) return;
    await apiClient.delete(`/api/comments/${commentId}`);
    setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? null);
  }

  return (
    <section className="mt-10 border-t border-gray-200 pt-6">
      <h2 className="text-lg font-semibold">Comments {comments ? `(${comments.length})` : ''}</h2>

      {user && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Add a comment..."
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitting ? 'Posting...' : 'Post comment'}
          </button>
        </form>
      )}

      <ul className="mt-6 space-y-4">
        {comments?.map((comment) => (
          <li key={comment.id} className="border-b border-gray-100 pb-4">
            <p className="text-sm font-medium">{comment.author.name}</p>
            <p className="mt-1 text-gray-700">{comment.content}</p>
            {user?.id === comment.authorId && (
              <button
                type="button"
                onClick={() => handleDelete(comment.id)}
                className="mt-1 text-xs text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
