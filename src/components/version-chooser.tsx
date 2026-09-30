import { Check, CheckCircle2 } from "lucide-react";
import { computeTrust, extractFacts, highlightDisagreement } from "@/lib/trust";
import type { InfoWithRelations } from "@/lib/types";
import { SubmitButton } from "./submit-button";
import { TrustPills } from "./trust-pills";
import { ScoreBadge } from "./trust-score";
import { formatDate } from "./ui";


/**
 * Toutes les versions d'un même sujet qui se contredisent, côte à côte.
 * Un bouton par version : « Cette version est la bonne ».
 */
export function VersionChooser({
  conflictId,
  versions,
  pending,
  canDecide,
  action,
  country,
}: {
  conflictId: string;
  versions: InfoWithRelations[];
  pending: boolean;
  canDecide: boolean;
  action: (formData: FormData) => Promise<void>;
  country?: string | null;
}) {
  const sorted = [...versions].sort((a, b) => a.source_updated_at.localeCompare(b.source_updated_at));
  const winner = pending ? null : sorted.find((v) => v.status === "active" && !v.superseded_by);

  return (
    <div>
      {pending && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span className="font-medium">{sorted.length} versions différentes :</span>
          {sorted.map((v) => (
            <code key={v.id} className="rounded bg-white px-2 py-0.5 font-semibold text-red-700">
              {extractFacts(v.content).join(", ") || "sans chiffre"}
            </code>
          ))}
        </div>
      )}

      <div className={`grid gap-4 ${sorted.length > 2 ? "lg:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-2"}`}>
        {sorted.map((v, i) => {
          const others = sorted.filter((o) => o.id !== v.id).map((o) => o.content);
          const trust = computeTrust(v, [], v.client?.country ?? country ?? v.country);
          const isWinner = winner?.id === v.id;
          return (
            <div
              key={v.id}
              className={`flex flex-col rounded-xl border bg-white shadow-sm ${
                isWinner ? "border-emerald-400 ring-2 ring-emerald-100" : !pending ? "opacity-60" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                    Version {i + 1}
                    {i === 0 ? " · la plus ancienne" : i === sorted.length - 1 ? " · la plus récente" : ""}
                  </p>
                  <p className="mt-0.5 font-medium">{v.title}</p>
                  <p className="text-xs text-slate-500">
                    {v.owner?.full_name ?? "Sans auteur"} · {formatDate(v.source_updated_at)}
                  </p>
                </div>
                {isWinner ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Retenue
                  </span>
                ) : (
                  <ScoreBadge trust={trust} />
                )}
              </div>
              <p className="flex-1 px-5 py-4 leading-relaxed text-slate-800">
                {highlightDisagreement(v.content, others).map((seg, j) =>
                  seg.mark ? (
                    <mark key={j} className="rounded bg-red-100 px-1 font-semibold text-red-800">
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={j}>{seg.text}</span>
                  ),
                )}
              </p>
              <div className="px-5 pb-4">
                <TrustPills info={v} />
              </div>
              {pending && canDecide && (
                <form action={action} className="border-t border-slate-100 p-4">
                  <input type="hidden" name="conflict_id" value={conflictId} />
                  <input type="hidden" name="winner_info_id" value={v.id} />
                  <SubmitButton variant="success" className="w-full">
                    <Check className="h-4 w-4" /> Cette version est la bonne
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {pending && canDecide && (
        <p className="mt-3 text-xs text-slate-500">
          La version choisie reste active ; les plus anciennes sont archivées, les plus récentes rejetées. Chaque
          auteur est prévenu et ton score d&apos;expertise augmente sur ce sujet.
        </p>
      )}
    </div>
  );
}
