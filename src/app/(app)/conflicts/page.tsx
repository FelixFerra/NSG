import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ClickableRow } from "@/components/clickable-row";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictGroups, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { extractFacts } from "@/lib/trust";
import { Badge, EmptyState, PageHeader, formatDate } from "@/components/ui";

export default async function ConflictsPage() {
  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, { employees, contexts }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);
  const byId = new Map(infos.map((i) => [i.id, i]));
  const groups = buildConflictGroups(conflicts);
  const pending = groups.filter((g) => g.pending).length;

  return (
    <>
      <PageHeader
        title="Conflits"
        subtitle={`${pending} sujet(s) en attente. Toutes les versions contradictoires d'un même sujet sont regroupées : on choisit la bonne.`}
      />
      {groups.length === 0 ? (
        <EmptyState>Aucune contradiction détectée.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">Sujet</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Versions en désaccord</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Périmètre</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Validation</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Date</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map((g) => {
                const versions = g.infoIds
                  .map((id) => byId.get(id))
                  .filter((v) => v !== undefined)
                  .sort((a, b) => a.source_updated_at.localeCompare(b.source_updated_at));
                const context = contexts.find((x) => x.id === g.contextId);
                const client = versions.find((v) => v.client)?.client;
                const scope = client?.name ?? versions[0]?.country ?? "—";
                const validators = g.assigneeIds.map((id) => employees.find((e) => e.id === id)?.full_name).filter(Boolean);
                const mine = g.pending && !!employee && g.assigneeIds.includes(employee.id);
                const winner = g.pending ? null : versions.find((v) => v.status === "active" && !v.superseded_by);
                return (
                  <ClickableRow key={g.key} href={`/conflicts/${g.key}`} className={g.pending ? "" : "text-slate-500"}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge tone={g.pending ? "warn" : "good"}>{g.pending ? "En attente" : "Tranché"}</Badge>
                      {mine && <span className="ml-1.5"><Badge tone="bad">À toi</Badge></span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/conflicts/${g.key}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                        {context?.label ?? "Sans sujet"}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {versions.length} versions{winner ? ` · retenue : ${winner.title}` : ""}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {versions.map((v) => (
                          <code
                            key={v.id}
                            title={v.title}
                            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                              winner?.id === v.id ? "bg-emerald-50 text-emerald-700" : g.pending ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-400 line-through"
                            }`}
                          >
                            {extractFacts(v.content).join(", ") || "?"}
                          </code>
                        ))}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 whitespace-nowrap lg:table-cell">{scope}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">{validators.join(", ") || "—"}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-slate-500 sm:table-cell">{formatDate(g.createdAt)}</td>
                    <td className="pr-3 text-slate-400">
                      <ChevronRight className="h-4 w-4" />
                    </td>
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
