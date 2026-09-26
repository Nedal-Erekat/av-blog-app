import type { Metadata } from 'next';
import { NewPostForm } from '@/components/NewPostForm';
import { getDraftHandoff, verifySession } from '@/lib/dal';

export const metadata: Metadata = {
  title: 'New Post',
};

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ handoff?: string }>;
}) {
  const { handoff } = await searchParams;
  await verifySession(handoff ? `/posts/new?handoff=${encodeURIComponent(handoff)}` : undefined);
  // A draft saved by an AI app (MCP) for this user to review.
  const handedOff = handoff ? await getDraftHandoff(handoff) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">New Post</h1>
      {handoff && !handedOff && (
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
          That draft link has expired or isn&apos;t yours. You can still write a post below.
        </p>
      )}
      {handedOff && (
        <p className="mt-4 rounded bg-indigo-50 p-3 text-sm text-indigo-800">
          Your AI app prepared this draft. Review and edit it, then click Publish.
        </p>
      )}
      <div className="mt-6">
        <NewPostForm initialDraft={handedOff ?? undefined} />
      </div>
    </main>
  );
}
