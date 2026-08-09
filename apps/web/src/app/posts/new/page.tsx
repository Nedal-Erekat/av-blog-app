import type { Metadata } from 'next';
import { NewPostForm } from '@/components/NewPostForm';
import { verifySession } from '@/lib/dal';

export const metadata: Metadata = {
  title: 'New Post',
};

export default async function NewPostPage() {
  await verifySession();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">New Post</h1>
      <div className="mt-6">
        <NewPostForm />
      </div>
    </main>
  );
}
