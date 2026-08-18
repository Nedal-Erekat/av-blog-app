import { CategoryFilterShell } from '@/components/CategoryFilterShell';
import { PostCard } from '@/components/PostCard';
import { PostsPagination } from '@/components/PostsPagination';
import { getCategories, getPosts } from '@/lib/data';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { category: activeCategory, page } = await searchParams;
  const pageNumber = Number(page) || 1;
  const [{ posts, pagination }, categories] = await Promise.all([
    getPosts(activeCategory, pageNumber),
    getCategories(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Avertra Blog</h1>

      <CategoryFilterShell categories={categories} activeCategory={activeCategory}>
        {posts.length === 0 ? (
          <p className="mt-6 text-gray-600">No posts yet.</p>
        ) : (
          <div className="mt-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </CategoryFilterShell>

      <PostsPagination pagination={pagination} category={activeCategory} />
    </main>
  );
}
