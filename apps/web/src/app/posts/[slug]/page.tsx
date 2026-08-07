import { notFound } from 'next/navigation';
import { PostOwnerActions } from '@/components/PostOwnerActions';
import { apiClient, ApiError } from '@/lib/api-client';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({ params }: { params: { slug: string } }) {
  let post: Post;
  try {
    const res = await apiClient.get<{ post: Post }>(`/api/posts/${params.slug}`);
    post = res.post;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-400">{new Date(post.createdAt).toLocaleDateString()}</p>
      <PostOwnerActions postId={post.id} authorId={post.authorId} slug={post.slug} />
      <div className="prose mt-6 whitespace-pre-wrap">{post.content}</div>
    </main>
  );
}
