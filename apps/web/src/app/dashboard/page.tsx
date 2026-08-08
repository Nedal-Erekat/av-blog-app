import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardPostActions } from '@/components/DashboardPostActions';
import { apiClient } from '@/lib/api-client';
import { getInitialUser } from '@/lib/auth-server';
import type { Post } from '@/lib/types';

export default async function DashboardPage() {
  const user = await getInitialUser();
  if (!user) {
    redirect('/login');
  }

  const { posts } = await apiClient.get<{ posts: Post[] }>(`/api/posts?authorId=${user.id}`);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Posts</h1>
        <Link href="/posts/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          New Post
        </Link>
      </div>
      {posts.length === 0 ? (
        <p className="mt-6 text-gray-600">You haven&apos;t written any posts yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-gray-200">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center justify-between py-4">
              <Link href={`/posts/${post.slug}`} className="hover:underline">
                {post.title}
              </Link>
              <div className="flex gap-3 text-sm">
                <Link href={`/posts/${post.slug}/edit`} className="text-gray-600 hover:text-gray-900">
                  Edit
                </Link>
                <DashboardPostActions postId={post.id} title={post.title} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
