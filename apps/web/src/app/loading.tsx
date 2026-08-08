export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse px-4 py-12">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 border-b border-gray-200 py-2">
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-100" />
            <div className="h-3 w-1/4 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
