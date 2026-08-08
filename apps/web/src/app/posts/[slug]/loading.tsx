export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl animate-pulse px-4 py-12">
      <div className="h-9 w-3/4 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-32 rounded bg-gray-100" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-full rounded bg-gray-100" />
        ))}
      </div>
    </main>
  );
}
