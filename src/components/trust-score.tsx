import type { TrustResult } from "@/lib/trust";

export const LEVEL = {
  high: { label: "Fiable", ring: "text-emerald-500", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500" },
  medium: { label: "À vérifier", ring: "text-amber-500", text: "text-amber-700", chip: "bg-amber-50 text-amber-800 ring-amber-200", bar: "bg-amber-500" },
  low: { label: "Peu fiable", ring: "text-red-500", text: "text-red-700", chip: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-500" },
} as const;

/** Grand anneau de score : réservé à la réponse principale d'une recherche. */
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
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">{trust.score}</span>
      </div>
      <span className={`mt-1 text-xs font-medium ${level.text}`}>{level.label}</span>
    </div>
  );
}

/** Pastille de score compacte, identique partout : « 85 · Fiable ». */
export function ScoreBadge({ trust, showLabel = true }: { trust: Pick<TrustResult, "score" | "level">; showLabel?: boolean }) {
  const level = LEVEL[trust.level];
  return (
    <span
      title={`Score de confiance : ${trust.score}/100 (${level.label})`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${level.chip}`}
    >
      {trust.score}
      {showLabel && <span className="font-medium">· {level.label}</span>}
    </span>
  );
}

const TONE_BAR = { good: "bg-emerald-500", warn: "bg-amber-400", bad: "bg-red-400" } as const;

/** Détail du score : une barre par facteur, avec la justification. */
export function TrustFactors({ trust }: { trust: TrustResult }) {
  return (
    <ul className="space-y-2.5">
      {trust.factors.map((f) => (
        <li key={f.label} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-start gap-3 text-sm">
          <span className="font-medium text-slate-700">{f.label}</span>
          <div className="min-w-0 pt-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${TONE_BAR[f.tone]}`} style={{ width: `${(f.points / f.max) * 100}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{f.detail}</p>
          </div>
          <span className="text-right text-xs tabular-nums text-slate-500">
            {f.points}/{f.max}
          </span>
        </li>
      ))}
      {trust.conflicts.length > 0 && (
        <li className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="font-medium text-slate-700">Conflit</span>
          <p className="text-xs text-red-600">Contredite par {trust.conflicts.length} autre(s) source(s)</p>
          <span className="text-right text-xs font-medium tabular-nums text-red-600">−10</span>
        </li>
      )}
      <li className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 border-t border-slate-200 pt-2 text-sm">
        <span className="font-semibold text-slate-900">Total</span>
        <span />
        <span className="text-right font-semibold tabular-nums">{trust.score}/100</span>
      </li>
    </ul>
  );
}
