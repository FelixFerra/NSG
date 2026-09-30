/** Squelette affiché instantanément pendant le chargement d'une page. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Chargement">
      <div className="mb-2 h-7 w-56 rounded-md bg-slate-200" />
      <div className="mb-6 h-4 w-80 max-w-full rounded-md bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-xl bg-white ring-1 ring-slate-200" />
        <div className="h-28 rounded-xl bg-white ring-1 ring-slate-200" />
      </div>
      <div className="mt-4 space-y-3">
        <div className="h-24 rounded-xl bg-white ring-1 ring-slate-200" />
        <div className="h-24 rounded-xl bg-white ring-1 ring-slate-200" />
      </div>
    </div>
  );
}
