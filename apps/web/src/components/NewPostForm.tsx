'use client';

import type { CreatePostInput } from '@av-blog/shared';
import { useRouter } from 'next/navigation';
import { PostForm } from '@/components/PostForm';
import { revalidatePostsList } from '@/lib/actions';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export function NewPostForm() {
  const router = useRouter();

  async function handleSubmit(input: CreatePostInput) {
    const { post } = await apiClient.post<{ post: Post }>('/api/posts', input);
    await revalidatePostsList();
    router.push(`/posts/${post.slug}`);
    router.refresh();
  }

  return <PostForm submitLabel="Publish" onSubmit={handleSubmit} />;
}
