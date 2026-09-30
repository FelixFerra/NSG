import Link from "next/link";
import { ArrowRight, AlertTriangle, UserX, Clock, Plug } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { CONNECTORS } from "@/lib/connectors";
import type { DataSource } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { ConnectorLogo } from "@/components/connector-logo";

export default async function DashboardPage() {
  const { supabase, employee } = await getCurrentEmployee();
  const [infos, { clients, employees }, sourcesRes] = await Promise.all([
    fetchInfos(supabase),
    fetchReferenceData(supabase),
    employee
      ? supabase.from("data_sources").select("*").eq("employee_id", employee.id).eq("status", "connected")
      : Promise.resolve({ data: [] }),
  ]);
  const connected = (sourcesRes.data ?? []) as DataSource[];

  const scored = infos.map((info) => ({ info, trust: computeTrust(info, infos) }));
  const withConflicts = scored.filter((s) => s.trust.conflicts.length > 0).length;
  const noOwner = infos.filter((i) => !i.employee_id).length;
  const stale = scored.filter((s) => s.trust.factors[0].tone === "bad").length;
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.trust.score, 0) / scored.length) : 0;

  const firstName = employee?.full_name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Bonjour${firstName ? ` ${firstName}` : ""}`}
        subtitle="Vue d'ensemble de la fiabilité du savoir interne."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Infos indexées" value={infos.length} hint={`${clients.length} clients · ${employees.length} employés`} />
        <Stat label="Confiance moyenne" value={`${avg}/100`} hint="Score explicable, voir la base de savoir" />
        <Stat label="Sources connectées" value={`${connected.length}/${CONNECTORS.length}`} hint="Pour ton compte" />
        <Stat label="Conflits détectés" value={withConflicts} hint="Infos contredites par une autre source" tone={withConflicts ? "bad" : undefined} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">Points d&apos;attention</h2>
          <ul className="space-y-3 text-sm">
            <Alert icon={AlertTriangle} tone="text-red-600" count={withConflicts} label="infos en conflit avec une autre source" />
            <Alert icon={UserX} tone="text-amber-600" count={noOwner} label="infos sans propriétaire identifié" />
            <Alert icon={Clock} tone="text-amber-600" count={stale} label="infos périmées ou archivées" />
          </ul>
          <Link href="/knowledge" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
            Ouvrir la base de savoir <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <h2 className="mb-4 font-medium">Tes sources</h2>
          {connected.length === 0 ? (
            <div className="text-sm text-slate-500">
              <p>Aucune source connectée pour l&apos;instant.</p>
              <Link href="/sources" className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500">
                <Plug className="h-4 w-4" /> Connecter mes outils
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {connected.map((s) => (
                <span key={s.id} className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pr-3 pl-1 text-sm">
                  <ConnectorLogo id={s.provider} size="sm" />
                  {CONNECTORS.find((c) => c.id === s.provider)?.name}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone?: "bad" }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "bad" ? "text-red-600" : ""}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </Card>
  );
}

function Alert({ icon: Icon, tone, count, label }: { icon: typeof AlertTriangle; tone: string; count: number; label: string }) {
  return (
    <li className="flex items-center gap-3">
      <Icon className={`h-4 w-4 ${count ? tone : "text-slate-300"}`} />
      <span className="font-semibold tabular-nums">{count}</span>
      <span className="text-slate-600">{label}</span>
    </li>
  );
}
