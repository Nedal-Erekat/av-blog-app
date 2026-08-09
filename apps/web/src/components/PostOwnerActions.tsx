'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { revalidatePost } from '@/lib/actions';

type PostOwnerActionsProps = {
  postId: string;
  slug: string;
};

// Rendered only when the DAL has already confirmed the viewer is the author —
// this component makes no authorization decision of its own.
export function PostOwnerActions({ postId, slug }: PostOwnerActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/posts/${postId}`);
      await revalidatePost(slug);
      router.push('/dashboard');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-4 flex gap-3 text-sm">
      <Link href={`/posts/${slug}/edit`} className="text-gray-600 hover:text-gray-900">
        Edit
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-red-600 hover:text-red-800 disabled:opacity-50"
      >
        {deleting ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
}
