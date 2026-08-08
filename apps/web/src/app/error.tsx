'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-gray-600">Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-sm text-white"
      >
        Try again
      </button>
    </main>
  );
}
