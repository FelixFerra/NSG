import Link from "next/link";
import { AlertTriangle, ChevronRight, Pencil, Plus, Search } from "lucide-react";
import { DeleteInfoButton } from "./delete-info-button";
import { ClickableRow } from "@/components/clickable-row";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictIndex, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { sourceName } from "@/lib/connectors";
import { EmptyState, PageHeader, formatDate } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { ScoreBadge, TrustFactors } from "@/components/trust-score";
import { ConnectorLogo } from "@/components/connector-logo";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export default async function KnowledgePage(props: PageProps<"/knowledge">) {
  const searchParams = await props.searchParams;
  const q = param(searchParams.q).toLowerCase();
  const contextId = UUID_RE.test(param(searchParams.context)) ? param(searchParams.context) : "";
  const added = param(searchParams.added);
  const updated = param(searchParams.updated);
  const deleted = param(searchParams.deleted);
  const conflictCount = Number.parseInt(param(searchParams.conflicts), 10) || 0;

  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, { contexts }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);
  const index = buildConflictIndex(conflicts, infos);

  const show = param(searchParams.show) || "active"; // active | all | mine
  const isActive = (i: (typeof infos)[number]) => i.status === "active" && !i.superseded_by;

  const results = infos
    .filter((i) => show === "all" || (show === "mine" ? i.employee_id === employee?.id : isActive(i)))
    .filter((i) => !contextId || i.context_id === contextId)
    .filter((i) => !q || `${i.title} ${i.content} ${i.source_label ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)))
    .map((info) => ({
      info,
      conflicts: index.get(info.id) ?? [],
      trust: computeTrust(info, (index.get(info.id) ?? []).map((c) => c.other), info.client?.country ?? info.country),
    }));
  const activeCount = infos.filter(isActive).length;

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`${activeCount} infos actives, ${infos.length - activeCount} archivées ou rejetées. Clique sur une ligne pour voir le détail et le calcul du score.`}
      >
        <Link href="/knowledge/new" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Ajouter une info
        </Link>
      </PageHeader>

      {(added || updated) && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${conflictCount ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {conflictCount ? (
            <>
              Info {added ? "ajoutée" : "modifiée"}. <strong>{conflictCount} contradiction(s)</strong> détectée(s) : l&apos;auteur de
              l&apos;info existante a été notifié pour validation. <Link href="/conflicts" className="font-medium underline">Voir les conflits</Link>
            </>
          ) : (
            `Info ${added ? "ajoutée" : "modifiée"}, aucune contradiction détectée.`
          )}
        </div>
      )}
      {deleted && (
        <p className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">Info supprimée.</p>
      )}

      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_200px_200px_auto]">
        <label className="relative">
          <span className="sr-only">Recherche</span>
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={param(searchParams.q)}
            placeholder="Filtrer par mot-clé"
            className="w-full rounded-md border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-500"
          />
        </label>
        <select name="context" defaultValue={contextId} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous les sujets</option>
          {contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="show" defaultValue={show} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="active">Infos actives</option>
          <option value="all">Toutes (y compris archivées)</option>
          <option value="mine">Mes infos</option>
        </select>
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrer
        </button>
      </form>

      {results.length === 0 ? (
        <EmptyState>Aucune info. Connecte des sources ou ajoute une info.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[40rem] table-fixed text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Document</th>
                <th className="w-36 px-4 py-2.5">Fiabilité</th>
                <th className="hidden w-36 px-4 py-2.5 xl:table-cell">Source</th>
                <th className="hidden w-40 px-4 py-2.5 lg:table-cell">Auteur</th>
                <th className="hidden w-32 px-4 py-2.5 sm:table-cell">Mis à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(({ info, trust, conflicts: infoConflicts }) => {
                const inactive = info.status !== "active" || !!info.superseded_by;
                const mine = !!employee && info.employee_id === employee.id;
                return (
                  <ClickableRow key={info.id} className={`align-top ${inactive ? "bg-slate-50/60 text-slate-400" : ""}`}>
                    <td className="px-4 py-3">
                      <details className="group">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
                            <span className={`truncate font-medium ${inactive ? "line-through decoration-slate-300" : "text-slate-900 group-open:text-indigo-700"}`}>
                              {info.title}
                            </span>
                            {infoConflicts.length > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-700">
                                <AlertTriangle className="h-3 w-3" /> Contredite
                              </span>
                            )}
                            {mine && <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">Moi</span>}
                          </div>
                          <p className="mt-0.5 truncate pl-6 text-xs text-slate-500">
                            {[info.context?.label, info.client?.name ?? (info.country ? `Général · ${info.country}` : "Général")].filter(Boolean).join(" · ")}
                          </p>
                        </summary>

                        <div className="mt-3 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_20rem]">
                          <div className="min-w-0 space-y-3">
                            <p className="leading-relaxed text-slate-800">{info.content}</p>
                            <TrustPills info={info} conflicts={infoConflicts.length} />
                            {infoConflicts.length > 0 && (
                              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                                <p className="font-medium">Contredite par :</p>
                                <ul className="mt-1 space-y-0.5">
                                  {infoConflicts.map(({ conflict, other }) => (
                                    <li key={conflict.id}>
                                      <Link href={`/conflicts/${conflict.id}`} className="underline hover:text-red-950">
                                        {other.title}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {mine && (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Link
                                  href={`/knowledge/${info.id}/edit`}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Modifier
                                </Link>
                                <DeleteInfoButton infoId={info.id} title={info.title} compact />
                              </div>
                            )}
                          </div>
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="mb-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">Détail du score</p>
                            <TrustFactors trust={trust} />
                          </div>
                        </div>
                      </details>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge trust={trust} />
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <ConnectorLogo id={info.source_type} size="xs" /> {sourceName(info.source_type)}
                      </span>
                    </td>
                    <td className="hidden truncate px-4 py-3 lg:table-cell">
                      {info.owner ? (
                        <Link href={`/team/${info.owner.id}`} className="hover:text-indigo-700 hover:underline">{info.owner.full_name}</Link>
                      ) : (
                        <span className="text-red-600">Sans auteur</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap sm:table-cell">{formatDate(info.source_updated_at)}</td>
                  </ClickableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
