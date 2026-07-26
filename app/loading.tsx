export default function GlobalLoading() {
  return (
    <div
      className="container mx-auto max-w-6xl px-4 py-8"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="motion-stagger">
        <div className="h-9 w-52 animate-pulse rounded-lg bg-storm-light/80 motion-reduce:animate-none" />
        <div className="mt-3 h-4 w-full max-w-md animate-pulse rounded bg-storm-light/60 motion-reduce:animate-none" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-storm-electric/10 motion-reduce:animate-none" />
              <div className="mt-4 h-5 w-2/3 animate-pulse rounded bg-storm-light/80 motion-reduce:animate-none" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-storm-light/60 motion-reduce:animate-none" />
              <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-storm-light/60 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading content…</span>
    </div>
  );
}
