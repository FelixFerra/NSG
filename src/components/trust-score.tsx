import type { TrustResult } from "@/lib/trust";

const LEVEL = {
  high: { label: "Fiable", ring: "text-emerald-500", text: "text-emerald-700" },
  medium: { label: "À vérifier", ring: "text-amber-500", text: "text-amber-700" },
  low: { label: "Peu fiable", ring: "text-red-500", text: "text-red-700" },
} as const;

export function TrustScore({ trust }: { trust: TrustResult }) {
  const level = LEVEL[trust.level];
  const circumference = 2 * Math.PI * 22;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 52 52" className="h-16 w-16 -rotate-90">
          <circle cx="26" cy="26" r="22" fill="none" strokeWidth="5" className="stroke-slate-100" />
          <circle
            cx="26"
            cy="26"
            r="22"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            stroke="currentColor"
            className={level.ring}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - trust.score / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
          {trust.score}
        </span>
      </div>
      <span className={`mt-1 text-xs font-medium ${level.text}`}>{level.label}</span>
    </div>
  );
}

const DOT = { good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500" } as const;

export function TrustFactors({ trust }: { trust: TrustResult }) {
  return (
    <ul className="space-y-1.5">
      {trust.factors.map((f) => (
        <li key={f.label} className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[f.tone]}`} />
          <span className="w-24 shrink-0 font-medium text-slate-700">{f.label}</span>
          <span className="flex-1 text-slate-600">{f.detail}</span>
          <span className="shrink-0 tabular-nums text-slate-400">
            +{f.points}/{f.max}
          </span>
        </li>
      ))}
      {trust.conflicts.length > 0 && (
        <li className="flex items-start gap-2 text-sm">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT.bad}`} />
          <span className="w-24 shrink-0 font-medium text-slate-700">Conflits</span>
          <span className="flex-1 text-slate-600">
            {trust.conflicts.length} autre(s) source(s) disent autre chose sur ce sujet
          </span>
          <span className="shrink-0 tabular-nums text-slate-400">−10</span>
        </li>
      )}
    </ul>
  );
}
