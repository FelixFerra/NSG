import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { authorityOf, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function TeamPage() {
  const { supabase, employee: me } = await getCurrentEmployee();
  const [infos, conflicts, { contexts, employees, expertise }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);

  const total = (id: string) => expertise.filter((x) => x.employee_id === id).reduce((s, x) => s + x.score, 0);
  const ranked = [...employees].sort((a, b) => total(b.id) - total(a.id));

  return (
    <>
      <PageHeader
        title="Collaborateurs"
        subtitle="Score de compétence par domaine : chaque conflit tranché rapporte +1 sur le sujet."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ranked.map((e) => {
          const scores = expertise
            .filter((x) => x.employee_id === e.id && x.score > 0)
            .sort((a, b) => b.score - a.score);
          const owned = infos.filter((i) => i.employee_id === e.id && i.status === "active").length;
          const resolvedCount = conflicts.filter((c) => c.resolved_by === e.id).length;
          return (
            <Card key={e.id}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {e.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <Link href={`/team/${e.id}`} className="block truncate font-medium hover:text-indigo-700 hover:underline">
                    {e.full_name} {e.id === me?.id && <span className="text-xs text-slate-400">(toi)</span>}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {[e.job_title, e.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {e.country && <span className="ml-auto"><Badge>{e.country}</Badge></span>}
              </div>

              <ul className="mt-4 space-y-2">
                {scores.length === 0 && <li className="text-sm text-slate-400">Pas encore de score.</li>}
                {scores.map((s) => {
                  const authority = authorityOf(s.score);
                  return (
                    <li key={s.context_id}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">
                          {contexts.find((c) => c.id === s.context_id)?.label ?? "—"}
                        </span>
                        <span className="text-slate-500">
                          {authority.label} · {s.score} pts
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, s.score * 7)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {owned} info(s) · {resolvedCount} conflit(s) tranché(s)
                </span>
                <Link href={`/team/${e.id}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                  Voir le profil <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
