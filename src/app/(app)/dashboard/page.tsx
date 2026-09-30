import Link from "next/link";
import { ArrowRight, AlertTriangle, UserX, Clock, Plug, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictIndex, fetchConflicts, fetchInfos, fetchNotifications } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { CONNECTORS } from "@/lib/connectors";
import type { DataSource } from "@/lib/types";
import { Card, PageHeader } from "@/components/ui";
import { ConnectorLogo } from "@/components/connector-logo";

export default async function DashboardPage() {
  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, notifications, sourcesRes] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchNotifications(supabase),
    employee
      ? supabase.from("data_sources").select("*").eq("employee_id", employee.id).eq("status", "connected")
      : Promise.resolve({ data: [] }),
  ]);
  const connected = (sourcesRes.data ?? []) as DataSource[];
  const index = buildConflictIndex(conflicts, infos);

  const active = infos.filter((i) => i.status === "active");
  const scored = active.map((info) => computeTrust(info, (index.get(info.id) ?? []).map((c) => c.other), info.country));
  const pending = conflicts.filter((c) => c.status === "pending");
  const mine = pending.filter((c) => c.assignee_id === employee?.id).length;
  const toHandle = notifications.filter((n) => n.status === "open" && n.kind !== "resolution").length;
  const noOwner = active.filter((i) => !i.employee_id).length;
  const stale = scored.filter((t) => t.factors[0].tone === "bad").length;

  const firstName = employee?.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Bonjour${firstName ? ` ${firstName}` : ""}`} subtitle="Santé de la base de savoir.">
        <Link href="/search" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          <Search className="h-4 w-4" /> Poser une question
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/inbox">
          <Stat label="À traiter dans ta boîte" value={toHandle} hint={mine ? `dont ${mine} conflit(s) à trancher` : "Demandes de validation et questions reçues"} tone={toHandle ? "bad" : undefined} />
        </Link>
        <Link href="/sources">
          <Stat label="Sources connectées" value={`${connected.length}/${CONNECTORS.length}`} hint="Pour ton compte" />
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">Points d&apos;attention</h2>
          <ul className="space-y-3 text-sm">
            <Alert icon={AlertTriangle} tone="text-red-600" count={pending.length} label="contradictions en attente de validation" />
            <Alert icon={UserX} tone="text-amber-600" count={noOwner} label="infos actives sans auteur identifié" />
            <Alert icon={Clock} tone="text-amber-600" count={stale} label="infos actives périmées" />
          </ul>
          <Link href="/conflicts" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
            Voir les conflits <ArrowRight className="h-4 w-4" />
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
    <Card className="h-full transition hover:border-indigo-300">
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
