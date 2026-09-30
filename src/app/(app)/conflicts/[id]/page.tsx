import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Scale } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { authorityOf, buildConflictGroups, fetchConflicts, fetchInfos, fetchReferenceData, groupIndex, rankExperts } from "@/lib/data";
import { Badge, formatDateTime } from "@/components/ui";
import { ExpertCard } from "@/components/expert-card";
import { VersionChooser } from "@/components/version-chooser";
import { resolveConflictGroup } from "../../actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ConflictPage(props: PageProps<"/conflicts/[id]">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, { employees, expertise, contexts }, canResolve] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
    supabase.rpc("can_resolve_conflict", { p_conflict_id: id }),
  ]);

  // N'importe quel conflit du groupe mène à la vue du groupe entier
  const group = groupIndex(buildConflictGroups(conflicts)).get(id);
  if (!group) notFound();
  const byId = new Map(infos.map((i) => [i.id, i]));
  const versions = group.infoIds.map((i) => byId.get(i)).filter((v) => v !== undefined);

  const context = contexts.find((c) => c.id === group.contextId);
  const client = versions.find((v) => v.client)?.client ?? null;
  const validators = group.assigneeIds.map((a) => employees.find((e) => e.id === a)?.full_name).filter(Boolean);
  const resolved = group.conflicts.find((c) => c.resolved_by);
  const resolver = employees.find((e) => e.id === resolved?.resolved_by);
  const experts = rankExperts(expertise, employees, { contextId: group.contextId, country: client?.country, limit: 2 });

  return (
    <>
      <Link href="/conflicts" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Tous les conflits
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Scale className="h-6 w-6 text-red-500" /> {context?.label ?? "Contradiction"}
            {client && <span className="text-slate-400">· {client.name}</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {versions.length} versions contradictoires · détecté le {formatDateTime(group.createdAt)}
            {validators.length > 0 && (
              <> · validation demandée à <strong className="text-slate-700">{validators.join(", ")}</strong></>
            )}
          </p>
        </div>
        <Badge tone={group.pending ? "warn" : "good"}>
          {group.pending ? "En attente" : `Tranché${resolver ? ` par ${resolver.full_name}` : ""}`}
        </Badge>
      </div>

      <VersionChooser
        conflictId={id}
        versions={versions}
        pending={group.pending}
        canDecide={group.pending && canResolve.data === true}
        action={resolveConflictGroup}
        country={client?.country}
      />

      {group.pending && experts.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-slate-700">Pas sûr·e ? Demande l&apos;avis d&apos;un expert :</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {experts.map((x) => (
              <ExpertCard
                key={x.employee.id}
                expert={x.employee}
                score={x.score}
                authority={authorityOf(x.score)}
                topic={context?.label ?? null}
                handoffMessage={`Peux-tu trancher entre ces ${versions.length} versions ?\n${versions.map((v) => `• ${v.title}`).join("\n")}`}
                clientId={client?.id}
                contextId={group.contextId}
                conflictId={id}
                isMe={x.employee.id === employee?.id}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
