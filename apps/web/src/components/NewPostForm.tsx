'use client';

import type { CreatePostInput } from '@av-blog/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AgentDraftPanel } from '@/components/AgentDraftPanel';
import { PostForm } from '@/components/PostForm';
import { revalidatePostsList } from '@/lib/actions';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export function NewPostForm() {
  const router = useRouter();
  // Each AI draft gets a new key, so the form re-mounts pre-filled with it.
  const [draft, setDraft] = useState<{ key: number; values: CreatePostInput } | null>(null);

  async function handleSubmit(input: CreatePostInput) {
    const { post } = await apiClient.post<{ post: Post }>('/api/posts', input);
    await revalidatePostsList();
    router.push(`/posts/${post.slug}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <AgentDraftPanel
        onDraft={(values) => setDraft((d) => ({ key: (d?.key ?? 0) + 1, values }))}
      />
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
