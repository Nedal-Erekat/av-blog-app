'use client';

import type { CreatePostInput } from '@av-blog/shared';
import { useEffect } from 'react';
import type { PublishChoice } from '@/lib/blog-actions';

const PREVIEW_CHARS = 800;

// The human-in-the-loop step: an AI (ours or the browser's) asked to publish this post. Nothing
// is published until the user clicks Publish here.
export function ConfirmPublishDialog({
  post,
  onChoose,
}: {
  post: CreatePostInput;
  onChoose: (choice: PublishChoice) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChoose('cancel');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChoose]);

  const preview =
    post.content.length > PREVIEW_CHARS ? `${post.content.slice(0, PREVIEW_CHARS)}…` : post.content;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-publish-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded bg-white p-6 shadow-lg"
      >
        <h2 id="confirm-publish-title" className="text-lg font-semibold">
          The assistant wants to publish this post
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Review it first. It will be public under your name.
        </p>

        <div className="mt-4 rounded border border-gray-200 p-4">
          <p className="font-semibold">{post.title}</p>
          {(post.category || post.excerpt) && (
            <p className="mt-1 text-sm text-gray-500">
              {[post.category, post.excerpt].filter(Boolean).join(' · ')}
            </p>
          )}
          <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{preview}</p>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onChoose('cancel')}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onChoose('edit')}
            className="rounded border border-gray-300 px-4 py-2 text-sm"
          >
            Edit first
          </button>
          <button
            type="button"
            onClick={() => onChoose('publish')}
            className="rounded bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
