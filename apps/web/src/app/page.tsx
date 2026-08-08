import Link from 'next/link';
import { PostCard } from '@/components/PostCard';
import { getCategories, getPosts } from '@/lib/data';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: activeCategory } = await searchParams;
  const [posts, categories] = await Promise.all([getPosts(activeCategory), getCategories()]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Avertra Blog</h1>

      {categories.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/" className={!activeCategory ? 'font-semibold underline' : 'text-gray-600'}>
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/?category=${category.slug}`}
              className={activeCategory === category.slug ? 'font-semibold underline' : 'text-gray-600'}
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
