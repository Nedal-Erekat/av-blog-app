import type { Metadata } from 'next';
import { EditPostForm } from '@/components/EditPostForm';
import { getPostForEdit } from '@/lib/dal';

export const metadata: Metadata = {
  title: 'Edit Post',
};

export default async function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Session and ownership are both settled inside the DAL; reaching this line
  // means the current user is the author.
  const post = await getPostForEdit(slug);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Edit Post</h1>
      <div className="mt-6">
        <EditPostForm post={post} />
      </div>
    </main>
  );
}
