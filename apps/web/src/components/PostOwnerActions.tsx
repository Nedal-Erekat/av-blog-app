'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';

type PostOwnerActionsProps = {
  postId: string;
  authorId: string;
  slug: string;
};

export function PostOwnerActions({ postId, authorId, slug }: PostOwnerActionsProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  if (!user || user.id !== authorId) return null;

  async function handleDelete() {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/posts/${postId}`);
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
