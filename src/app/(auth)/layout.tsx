import { ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-slate-900">
          <ShieldCheck className="h-7 w-7 text-indigo-600" />
          <span className="text-xl font-semibold">NSG Trust</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Trouver l&apos;info. La comprendre. Savoir si on peut s&apos;y fier.
        </p>
      </div>
    </main>
  );
}
