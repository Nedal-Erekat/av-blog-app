'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PostForm } from '@/components/PostForm';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export default function EditPostPage({ params }: { params: { slug: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ post: Post }>(`/api/posts/${params.slug}`)
      .then((res) => setPost(res.post))
      .catch(() => router.push('/'));
  }, [params.slug, router]);

  useEffect(() => {
    if (loading || !post) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (post.authorId !== user.id) {
      setNotAllowed(true);
    }
  }, [loading, user, post, router]);

  if (!post || loading) return null;

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
          initialValues={{ title: post.title, content: post.content, excerpt: post.excerpt }}
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
