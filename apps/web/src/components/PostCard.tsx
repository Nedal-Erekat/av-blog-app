import Link from 'next/link';
import type { Post } from '@/lib/types';

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="border-b border-gray-200 py-6">
      <Link href={`/posts/${post.slug}`} className="text-xl font-semibold hover:underline">
        {post.title}
      </Link>
      <p className="mt-2 text-gray-600">{post.excerpt}</p>
      <p className="mt-2 text-xs text-gray-400">
        {new Date(post.createdAt).toLocaleDateString()}
        {post.category ? ` · ${post.category.name}` : ''}
        {` · ${post._count.likes} likes · ${post._count.comments} comments`}
      </p>
    </article>
  );
}
