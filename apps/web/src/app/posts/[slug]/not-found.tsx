import Link from 'next/link';

export default function PostNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Post not found</h1>
      <p className="mt-2 text-gray-600">This post doesn&apos;t exist or may have been deleted.</p>
      <Link href="/" className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-sm text-white">
        Back to posts
      </Link>
    </main>
  );
}
