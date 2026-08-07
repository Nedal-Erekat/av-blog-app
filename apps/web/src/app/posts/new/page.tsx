'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PostForm } from '@/components/PostForm';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export default function NewPostPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">New Post</h1>
      <div className="mt-6">
        <PostForm
          submitLabel="Publish"
          onSubmit={async (input) => {
            const { post } = await apiClient.post<{ post: Post }>('/api/posts', input);
            router.push(`/posts/${post.slug}`);
            router.refresh();
          }}
        />
      </div>
    </main>
  );
}
