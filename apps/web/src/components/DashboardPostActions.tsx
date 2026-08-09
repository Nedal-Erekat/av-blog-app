'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { revalidatePostsList } from '@/lib/actions';

export function DashboardPostActions({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/api/posts/${postId}`);
      await revalidatePostsList();
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {deleting ? 'Deleting...' : 'Delete'}
    </button>
  );
}
