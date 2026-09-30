import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, EmptyState, PageHeader, formatDate } from "@/components/ui";

const STATUS = {
  pending: { label: "En attente", tone: "warn" },
  accepted: { label: "B validée", tone: "good" },
  rejected: { label: "B rejetée", tone: "neutral" },
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

  return (
    <>
      <PageHeader
        title="Conflits"
        subtitle="Infos contradictoires détectées automatiquement. Rien n'est masqué : chaque conflit est tranché par un humain."
      />
      {sorted.length === 0 ? (
        <EmptyState>Aucune contradiction détectée.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {sorted.map((c) => {
            const a = byId.get(c.original_info_id);
            const b = byId.get(c.challenger_info_id);
            const assignee = employees.find((e) => e.id === c.assignee_id);
            const context = contexts.find((x) => x.id === c.context_id);
            const status = STATUS[c.status];
            return (
              <Link
                key={c.id}
                href={`/conflicts/${c.id}`}
                className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-0 hover:bg-slate-50 md:flex-row md:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {context && <Badge tone="info">{context.label}</Badge>}
                    {c.assignee_id && c.assignee_id === employee?.id && c.status === "pending" && (
                      <Badge tone="bad">À toi de trancher</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 truncate text-sm">
                    <span className="text-slate-500">A</span> {a?.title ?? "—"}{" "}
                    <span className="text-slate-400">vs</span> <span className="text-slate-500">B</span> {b?.title ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs text-slate-500">
                  <span>{assignee ? `Validation : ${assignee.full_name}` : "Aucun validateur"}</span>
                  <span>{formatDate(c.created_at)}</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
