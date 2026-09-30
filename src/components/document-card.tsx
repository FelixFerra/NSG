import type { TrustResult } from "@/lib/trust";
import type { InfoWithRelations } from "@/lib/types";
import { TrustPills } from "./trust-pills";
import { ScoreBadge, TrustFactors } from "./trust-score";

/**
 * Présentation unique d'un document, partout dans l'appli :
 * titre + score, contenu, preuves de fiabilité, détail du score repliable.
 */
export function DocumentCard({
  info,
  trust,
  children,
  subtle = false,
}: {
  info: InfoWithRelations;
  trust: TrustResult;
  /** Actions ou compléments affichés en bas de la carte. */
  children?: React.ReactNode;
  /** Rendu atténué (info remplacée, archivée…). */
  subtle?: boolean;
}) {
  const inactive = info.status !== "active" || !!info.superseded_by;
  return (
    <article className={`rounded-lg border border-slate-200 bg-white p-4 ${subtle || inactive ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {info.context && <p className="text-xs font-medium text-indigo-600">{info.context.label}</p>}
          <h3 className={`font-medium text-slate-900 ${inactive ? "line-through decoration-slate-300" : ""}`}>{info.title}</h3>
        </div>
        <ScoreBadge trust={trust} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{info.content}</p>
      <div className="mt-3">
        <TrustPills info={info} conflicts={trust.conflicts.length} />
      </div>
      <details className="mt-3 group">
        <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">
          Pourquoi {trust.score}/100 ?
        </summary>
        <div className="mt-3 rounded-md bg-slate-50 p-3">
          <TrustFactors trust={trust} />
        </div>
      </details>
      {children && <div className="mt-3 border-t border-slate-100 pt-3">{children}</div>}
    </article>
  );
}
