import Link from 'next/link';
import { PostCard } from '@/components/PostCard';
import { apiClient } from '@/lib/api-client';
import type { Category, Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: { category?: string } }) {
  const categoryQuery = searchParams.category ? `?category=${searchParams.category}` : '';
  const [{ posts }, { categories }] = await Promise.all([
    apiClient.get<{ posts: Post[] }>(`/api/posts${categoryQuery}`),
    apiClient.get<{ categories: Category[] }>('/api/categories'),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Avertra Blog</h1>

      {categories.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/" className={!searchParams.category ? 'font-semibold underline' : 'text-gray-600'}>
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?category=${category.slug}`}
              className={searchParams.category === category.slug ? 'font-semibold underline' : 'text-gray-600'}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      )}

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
