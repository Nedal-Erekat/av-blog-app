import { PostTitleLink } from '@/components/PostTitleLink';
import type { Post } from '@/lib/types';

// `similarity` is set on semantic search results, to show how close the match is.
export function PostCard({ post, similarity }: { post: Post; similarity?: number }) {
  return (
    <article className="border-b border-gray-200 py-6">
      <PostTitleLink href={`/posts/${post.slug}`} title={post.title} />
      <p className="mt-2 text-gray-600">{post.excerpt}</p>
      <p className="mt-2 text-xs text-gray-400">
        {new Date(post.createdAt).toLocaleDateString()}
        {post.category ? ` · ${post.category.name}` : ''}
        {` · ${post._count.likes} likes · ${post._count.comments} comments`}
        {similarity !== undefined ? ` · ${Math.round(similarity * 100)}% match` : ''}
      </p>
    </article>
  );
}
