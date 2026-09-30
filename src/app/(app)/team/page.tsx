import { Mail } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function TeamPage() {
  const { supabase, employee: me } = await getCurrentEmployee();
  const [infos, { contexts, employees }] = await Promise.all([
    fetchInfos(supabase),
    fetchReferenceData(supabase),
  ]);
  const labelOf = (slug: string) => contexts.find((c) => c.slug === slug)?.label ?? slug;

  return (
    <>
      <PageHeader title="Experts" subtitle="Qui maintient quelle info, et qui contacter par sujet et par pays." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {employees.map((e) => {
          const owned = infos.filter((i) => i.employee_id === e.id).length;
          return (
            <Card key={e.id}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                  {e.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {e.full_name} {e.id === me?.id && <span className="text-xs text-slate-400">(toi)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {[e.job_title, e.department].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {e.country && <span className="ml-auto"><Badge>{e.country}</Badge></span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.expertise.map((slug) => (
                  <Badge key={slug} tone="info">{labelOf(slug)}</Badge>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">{owned} info(s) maintenue(s)</span>
                <a href={`mailto:${e.email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                  <Mail className="h-3.5 w-3.5" /> Contacter
                </a>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
