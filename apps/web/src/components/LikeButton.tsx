'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/api-client';

export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    if (!user || pending) return;
    setPending(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));
    try {
      const res = await apiClient.post<{ liked: boolean; likeCount: number }>(`/api/posts/${postId}/like`);
      setLiked(res.liked);
      setCount(res.likeCount);
    } catch {
      setLiked(!nextLiked);
      setCount((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={!user || pending}
      className={`rounded border px-3 py-1 text-sm ${
        liked ? 'border-red-500 text-red-600' : 'border-gray-300 text-gray-600'
      } disabled:opacity-50`}
    >
      {liked ? '♥' : '♡'} {count}
    </button>
  );
}
