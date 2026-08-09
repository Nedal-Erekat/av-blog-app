'use client';

import type { CreatePostInput } from '@av-blog/shared';
import { useRouter } from 'next/navigation';
import { PostForm } from '@/components/PostForm';
import { revalidatePost } from '@/lib/actions';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export function EditPostForm({ post }: { post: Post }) {
  const router = useRouter();

  async function handleSubmit(input: CreatePostInput) {
    const { post: updated } = await apiClient.patch<{ post: Post }>(`/api/posts/${post.id}`, input);
    await revalidatePost(updated.slug);
    router.push(`/posts/${updated.slug}`);
    router.refresh();
  }

  return (
    <PostForm
      initialValues={{
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        category: post.category?.name ?? '',
      }}
      submitLabel="Save changes"
      onSubmit={handleSubmit}
    />
  );
}
