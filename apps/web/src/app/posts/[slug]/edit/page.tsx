'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { PostForm } from '@/components/PostForm';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export default function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    apiClient
      .get<{ post: Post }>(`/api/posts/${slug}`)
      .then((res) => setPost(res.post))
      .catch(() => router.push('/'));
  }, [slug, router]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (!post || loading || !user) return null;

  const notAllowed = post.authorId !== user.id;

  if (notAllowed) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-600">You can only edit your own posts.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Edit Post</h1>
      <div className="mt-6">
        <PostForm
          initialValues={{
            title: post.title,
            content: post.content,
            excerpt: post.excerpt,
            category: post.category?.name ?? '',
          }}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            const { post: updated } = await apiClient.patch<{ post: Post }>(`/api/posts/${post.id}`, input);
            router.push(`/posts/${updated.slug}`);
            router.refresh();
          }}
        />
      </div>
    </main>
  );
}
