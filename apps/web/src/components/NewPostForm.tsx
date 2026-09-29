'use client';

import type { CreatePostInput } from '@av-blog/shared';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AgentDraftPanel } from '@/components/AgentDraftPanel';
import { PostForm } from '@/components/PostForm';
import { revalidatePostsList } from '@/lib/actions';
import { apiClient } from '@/lib/api-client';
import { DRAFT_READY_EVENT, takePendingDraft } from '@/lib/pending-draft';
import type { Post } from '@/lib/types';

export function NewPostForm({ initialDraft }: { initialDraft?: CreatePostInput }) {
  const router = useRouter();
  // Each AI draft gets a new key, so the form re-mounts pre-filled with it.
  const [draft, setDraft] = useState<{ key: number; values: CreatePostInput } | null>(
    initialDraft ? { key: 1, values: initialDraft } : null,
  );
  const showDraft = useCallback(
    (values: CreatePostInput) => setDraft((d) => ({ key: (d?.key ?? 0) + 1, values })),
    [],
  );

  // A draft handed over by the command bar or a WebMCP agent: pick it up on arrival, or live if
  // this page is already open.
  useEffect(() => {
    const pickUp = () => {
      const pending = takePendingDraft();
      if (pending) showDraft(pending);
    };
    pickUp();
    window.addEventListener(DRAFT_READY_EVENT, pickUp);
    return () => window.removeEventListener(DRAFT_READY_EVENT, pickUp);
  }, [showDraft]);

  async function handleSubmit(input: CreatePostInput) {
    const { post } = await apiClient.post<{ post: Post }>('/api/posts', input);
    await revalidatePostsList();
    router.push(`/posts/${post.slug}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <AgentDraftPanel onDraft={showDraft} />
      <PostForm
        key={draft?.key ?? 0}
        initialValues={
          draft
            ? {
                title: draft.values.title,
                content: draft.values.content,
                excerpt: draft.values.excerpt ?? '',
                category: draft.values.category ?? '',
              }
            : undefined
        }
        submitLabel="Publish"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
