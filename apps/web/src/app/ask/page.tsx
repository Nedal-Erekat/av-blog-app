import type { Metadata } from 'next';
import { AskBlog } from '@/components/AskBlog';
import { verifySession } from '@/lib/dal';

export const metadata: Metadata = {
  title: 'Ask the blog',
};

export default async function AskPage() {
  // Asking costs AI quota, so it's for signed-in users (the API enforces this too).
  await verifySession();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">Ask the blog</h1>
      <p className="mt-2 text-gray-600">
        Ask a question and get an answer based only on what&apos;s been written here, with links to
        the posts it came from.
      </p>
      <div className="mt-6">
        <AskBlog />
      </div>
    </main>
  );
}
