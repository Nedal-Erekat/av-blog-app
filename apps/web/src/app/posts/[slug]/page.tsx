import { notFound } from 'next/navigation';
import { CommentSection } from '@/components/CommentSection';
import { LikeButton } from '@/components/LikeButton';
import { PostOwnerActions } from '@/components/PostOwnerActions';
import { ApiError } from '@/lib/api-client';
import { getPost } from '@/lib/data';
import type { Post } from '@/lib/types';

export default async function PostDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let post: Post;
  try {
    post = await getPost(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-400">
        {new Date(post.createdAt).toLocaleDateString()}
        {post.category ? ` · ${post.category.name}` : ''}
      </p>
      <PostOwnerActions postId={post.id} authorId={post.authorId} slug={post.slug} />
      <div className="mt-4">
        <LikeButton postId={post.id} initialCount={post._count.likes} />
      </div>
      <div className="prose mt-6 whitespace-pre-wrap">{post.content}</div>
      <CommentSection postId={post.id} />
    </main>
  );
}
