import Link from "next/link";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictIndex, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { TrustFactors, TrustScore } from "@/components/trust-score";

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
        <div className="space-y-4">
          {results.map(({ info, trust, conflicts: infoConflicts }) => (
            <Card key={info.id}>
              <div className="flex gap-5">
                <TrustScore trust={trust} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium">{info.title}</h2>
                    {info.context && <Badge tone="info">{info.context.label}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{info.content}</p>
                  <div className="mt-3">
                    <TrustPills info={info} />
                  </div>
                  {infoConflicts.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Contredite par :
                      {infoConflicts.map(({ conflict, other }) => (
                        <Link key={conflict.id} href={`/conflicts/${conflict.id}`} className="font-medium underline">
                          {other.title}
                        </Link>
                      ))}
                    </div>
                  )}
                  <details className="mt-3 rounded-lg bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">Pourquoi ce score ?</summary>
                    <div className="mt-3">
                      <TrustFactors trust={trust} />
                    </div>
                  </details>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
