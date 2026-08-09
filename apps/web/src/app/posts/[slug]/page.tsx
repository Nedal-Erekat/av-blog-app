import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CommentSection } from '@/components/CommentSection';
import { LikeButton } from '@/components/LikeButton';
import { PostOwnerActions } from '@/components/PostOwnerActions';
import { ApiError } from '@/lib/api-client';
import { getLikeStatus, isPostAuthor } from '@/lib/dal';
import { getComments, getPost } from '@/lib/data';
import type { Post } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPost(slug);
    return {
      title: post.title,
      description: post.excerpt || undefined,
    };
  } catch {
    return {};
  }
}

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

  const [comments, initialLiked, canManage] = await Promise.all([
    getComments(post.id),
    getLikeStatus(post.id),
    isPostAuthor(post.authorId),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-400">
        {new Date(post.createdAt).toLocaleDateString()}
        {post.category ? ` · ${post.category.name}` : ''}
      </p>
      {canManage && <PostOwnerActions postId={post.id} slug={post.slug} />}
      <div className="mt-4">
        <LikeButton postId={post.id} initialCount={post._count.likes} initialLiked={initialLiked} />
      </div>
      <div className="prose mt-6 whitespace-pre-wrap">{post.content}</div>
      <CommentSection postId={post.id} initialComments={comments} />
    </main>
  );
}
