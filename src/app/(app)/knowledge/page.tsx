import Link from "next/link";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictIndex, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { sourceName } from "@/lib/connectors";
import { EmptyState, PageHeader, formatDate } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { TrustFactors } from "@/components/trust-score";

const SCORE_TONE = {
  high: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-red-50 text-red-700",
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export default async function KnowledgePage(props: PageProps<"/knowledge">) {
  const searchParams = await props.searchParams;
  const q = param(searchParams.q).toLowerCase();
  const contextId = UUID_RE.test(param(searchParams.context)) ? param(searchParams.context) : "";
  const added = param(searchParams.added);
  const conflictCount = Number.parseInt(param(searchParams.conflicts), 10) || 0;

  const { supabase } = await getCurrentEmployee();
  const [infos, conflicts, { contexts }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);
  const index = buildConflictIndex(conflicts, infos);

  const results = infos
    .filter((i) => !contextId || i.context_id === contextId)
    .filter((i) => !q || `${i.title} ${i.content} ${i.source_label ?? ""}`.toLowerCase().includes(q))
    .map((info) => ({
      info,
      conflicts: index.get(info.id) ?? [],
      trust: computeTrust(info, (index.get(info.id) ?? []).map((c) => c.other), info.client?.country ?? info.country),
    }));

  return (
    <>
      <PageHeader title="Documents" subtitle="Tout le savoir indexé, avec ses preuves de fiabilité.">
        <Link href="/knowledge/new" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Ajouter une info
        </Link>
      </PageHeader>

      {added && (
        <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${conflictCount ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {conflictCount ? (
            <>
              Info ajoutée. <strong>{conflictCount} contradiction(s)</strong> détectée(s) : l&apos;auteur de
              l&apos;info existante a été notifié pour validation. <Link href="/conflicts" className="font-medium underline">Voir les conflits</Link>
            </>
          ) : (
            "Info ajoutée, aucune contradiction détectée."
          )}
        </div>
      )}

      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_220px_auto]">
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
        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filtrer
        </button>
      </form>

      {results.length === 0 ? (
        <EmptyState>Aucune info. Connecte des sources ou ajoute une info.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="w-16 px-4 py-2.5 text-center">Score</th>
                <th className="px-4 py-2.5">Document</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Sujet</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Périmètre</th>
                <th className="hidden px-4 py-2.5 xl:table-cell">Source</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Auteur</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Mis à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(({ info, trust, conflicts: infoConflicts }) => {
                const inactive = info.status !== "active" || !!info.superseded_by;
                return (
                  <tr key={info.id} className={`align-top ${inactive ? "text-slate-400" : ""}`}>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block min-w-10 rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums ${SCORE_TONE[trust.level]}`}>
                        {trust.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <details className="group">
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <span className={`font-medium group-open:text-indigo-700 ${inactive ? "line-through decoration-slate-300" : "text-slate-900"}`}>
                            {info.title}
                          </span>
                          {infoConflicts.length > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-red-600">
                              <AlertTriangle className="h-3.5 w-3.5" /> {infoConflicts.length} conflit(s)
                            </span>
                          )}
                          <span className="block truncate text-xs text-slate-500 group-open:hidden">{info.content}</span>
                        </summary>
                        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                          <p className="text-slate-700">{info.content}</p>
                          <TrustPills info={info} />
                          {infoConflicts.length > 0 && (
                            <p className="flex flex-wrap items-center gap-2 text-red-700">
                              Contredite par :
                              {infoConflicts.map(({ conflict, other }) => (
                                <Link key={conflict.id} href={`/conflicts/${conflict.id}`} className="font-medium underline">
                                  {other.title}
                                </Link>
                              ))}
                            </p>
                          )}
                          <div>
                            <p className="mb-2 text-xs font-medium text-slate-500 uppercase">Pourquoi {trust.score}/100</p>
                            <TrustFactors trust={trust} />
                          </div>
                        </div>
                      </details>
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap lg:table-cell">{info.context?.label ?? "—"}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap md:table-cell">
                      {info.client ? (
                        <Link href={`/clients/${info.client.id}`} className="hover:text-indigo-700 hover:underline">{info.client.name}</Link>
                      ) : (
                        info.country ?? "—"
                      )}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap xl:table-cell">{sourceName(info.source_type)}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap lg:table-cell">
                      {info.owner ? (
                        <Link href={`/team/${info.owner.id}`} className="hover:text-indigo-700 hover:underline">{info.owner.full_name}</Link>
                      ) : (
                        <span className="text-red-500">Sans auteur</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap sm:table-cell">{formatDate(info.source_updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
