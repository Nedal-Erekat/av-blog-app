'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiClient.get<{ posts: Post[] }>(`/api/posts?authorId=${user.id}`).then((res) => setPosts(res.posts));
  }, [user]);

  async function handleDelete(post: Post) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeletingId(post.id);
    try {
      await apiClient.delete(`/api/posts/${post.id}`);
      setPosts((prev) => prev?.filter((p) => p.id !== post.id) ?? null);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading || !user || !posts) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Posts</h1>
        <Link href="/posts/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          New Post
        </Link>
      </div>
      {posts.length === 0 ? (
        <p className="mt-6 text-gray-600">You haven&apos;t written any posts yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center justify-between py-4">
              <Link href={`/posts/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
              <div className="flex gap-3 text-sm">
                <Link href={`/posts/${post.slug}/edit`} className="text-gray-600 hover:text-gray-900">
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(post)}
                  disabled={deletingId === post.id}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
