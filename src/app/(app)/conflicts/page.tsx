import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, EmptyState, PageHeader, formatDate } from "@/components/ui";

const STATUS = {
  pending: { label: "En attente", tone: "warn" },
  accepted: { label: "B validée", tone: "good" },
  rejected: { label: "A conservée", tone: "neutral" },
  obsolete: { label: "Sans objet", tone: "neutral" },
} as const;

export default async function ConflictsPage() {
  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, { employees, contexts }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);
  const byId = new Map(infos.map((i) => [i.id, i]));
  const sorted = [...conflicts].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
  const pending = conflicts.filter((c) => c.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Conflits"
        subtitle={`${pending} en attente sur ${conflicts.length}. Rien n'est masqué : chaque contradiction est tranchée par un humain.`}
      />
      {sorted.length === 0 ? (
        <EmptyState>Aucune contradiction détectée.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5">A · version actuelle</th>
                <th className="hidden px-4 py-2.5 md:table-cell">B · nouvelle version</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Sujet</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Validation</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Détecté</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((c) => {
                const a = byId.get(c.original_info_id);
                const b = byId.get(c.challenger_info_id);
                const assignee = employees.find((e) => e.id === c.assignee_id);
                const context = contexts.find((x) => x.id === c.context_id);
                const status = STATUS[c.status];
                const mine = c.status === "pending" && c.assignee_id === employee?.id;
                return (
                  <tr key={c.id} className={c.status === "pending" ? "hover:bg-slate-50" : "text-slate-500 hover:bg-slate-50"}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {mine && <span className="ml-1.5"><Badge tone="bad">À toi</Badge></span>}
                    </td>
                    <td className="max-w-64 px-4 py-3">
                      <Link href={`/conflicts/${c.id}`} className="block truncate font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                        {a?.title ?? "—"}
                      </Link>
                      <p className="truncate text-xs text-slate-500 md:hidden">vs {b?.title ?? "—"}</p>
                    </td>
                    <td className="hidden max-w-64 truncate px-4 py-3 md:table-cell">{b?.title ?? "—"}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap lg:table-cell">{context?.label ?? "—"}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap lg:table-cell">{assignee?.full_name ?? "—"}</td>
                    <td className="hidden px-4 py-3 whitespace-nowrap text-slate-500 sm:table-cell">{formatDate(c.created_at)}</td>
                    <td className="pr-3">
                      <Link href={`/conflicts/${c.id}`} aria-label="Ouvrir le conflit" className="text-slate-400 hover:text-slate-700">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
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
