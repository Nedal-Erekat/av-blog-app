import Link from 'next/link';
import type { Pagination } from '@/lib/types';

function pageHref(category: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

export function PostsPagination({
  pagination,
  category,
}: {
  pagination: Pagination;
  category?: string;
}) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-between text-sm" aria-label="Posts pagination">
      {page > 1 ? (
        <Link href={pageHref(category, page - 1)} className="text-gray-600 hover:text-gray-900">
          &larr; Previous
        </Link>
      ) : (
        <span className="text-gray-300">&larr; Previous</span>
      )}

      <span className="text-gray-500">
        Page {page} of {totalPages}
      </span>

      {page < totalPages ? (
        <Link href={pageHref(category, page + 1)} className="text-gray-600 hover:text-gray-900">
          Next &rarr;
        </Link>
      ) : (
        <span className="text-gray-300">Next &rarr;</span>
      )}
    </nav>
  );
}
