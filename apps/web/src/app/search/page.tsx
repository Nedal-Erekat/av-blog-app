import { PostCard } from '@/components/PostCard';
import { searchPosts } from '@/lib/data';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  if (query.length < 2) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">Search</h1>
        <p className="mt-6 text-gray-600">Type at least 2 characters in the search box above.</p>
      </main>
    );
  }

  const { mode, results } = await searchPosts(query);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">Results for &ldquo;{query}&rdquo;</h1>
      <p className="mt-2 text-sm text-gray-500">
        {mode === 'semantic'
          ? '✨ Matched by meaning, not just exact words.'
          : 'Keyword match (AI search is unavailable right now).'}
      </p>

      {results.length === 0 ? (
        <p className="mt-6 text-gray-600">No matching posts.</p>
      ) : (
        <div className="mt-6">
          {results.map(({ post, similarity }) => (
            <PostCard key={post.id} post={post} similarity={similarity ?? undefined} />
          ))}
        </div>
      )}
    </main>
  );
}
