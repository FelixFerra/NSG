import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { authorityOf, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, PageHeader } from "@/components/ui";

export default async function TeamPage() {
  const { supabase, employee: me } = await getCurrentEmployee();
  const [infos, conflicts, { contexts, employees, expertise }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);

  const total = (id: string) => expertise.filter((x) => x.employee_id === id).reduce((s, x) => s + x.score, 0);
  const ranked = [...employees].sort((a, b) => total(b.id) - total(a.id));
  const labelOf = (id: string) => contexts.find((c) => c.id === id)?.label ?? "—";

  return (
    <>
      <PageHeader
        title="Collaborateurs"
        subtitle="Score de compétence par domaine : chaque conflit tranché ou question résolue rapporte +1."
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Collaborateur</th>
              <th className="hidden px-4 py-2.5 sm:table-cell">Pays</th>
              <th className="hidden px-4 py-2.5 md:table-cell">Domaines d&apos;expertise</th>
              <th className="hidden px-4 py-2.5 text-right lg:table-cell">Infos</th>
              <th className="hidden px-4 py-2.5 text-right lg:table-cell">Conflits tranchés</th>
              <th className="px-4 py-2.5 text-right">Score</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ranked.map((e) => {
              const scores = expertise
                .filter((x) => x.employee_id === e.id && x.score > 0)
                .sort((a, b) => b.score - a.score);
              const sum = total(e.id);
              const owned = infos.filter((i) => i.employee_id === e.id && i.status === "active").length;
              const resolved = conflicts.filter((c) => c.resolved_by === e.id).length;
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {e.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/team/${e.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                          {e.full_name}
                        </Link>
                        {e.id === me?.id && <span className="ml-1.5 text-xs text-slate-400">(toi)</span>}
                        <p className="truncate text-xs text-slate-500">{[e.job_title, e.department].filter(Boolean).join(" · ") || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{e.country ?? "—"}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {scores.length === 0 && <span className="text-slate-400">—</span>}
                      {scores.slice(0, 3).map((s) => (
                        <Badge key={s.context_id} tone="info">
                          {labelOf(s.context_id)} · {s.score}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-slate-600 lg:table-cell">{owned}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-slate-600 lg:table-cell">{resolved}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold tabular-nums">{sum}</span>
                    <span className="ml-1.5 hidden text-xs text-slate-500 sm:inline">{sum > 0 ? authorityOf(sum).label : ""}</span>
                  </td>
                  <td className="pr-3">
                    <Link href={`/team/${e.id}`} aria-label={`Voir le profil de ${e.full_name}`} className="text-slate-400 hover:text-slate-700">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
