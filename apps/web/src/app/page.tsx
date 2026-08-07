import { PostCard } from '@/components/PostCard';
import { apiClient } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { posts } = await apiClient.get<{ posts: Post[] }>('/api/posts');

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Avertra Blog</h1>
      {posts.length === 0 ? (
        <p className="mt-6 text-gray-600">No posts yet.</p>
      ) : (
        <div className="mt-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </main>
  );
}
