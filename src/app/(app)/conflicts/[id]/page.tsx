import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Scale, X } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { authorityOf, buildConflictIndex, fetchConflicts, fetchInfos, fetchReferenceData, rankExperts } from "@/lib/data";
import { computeTrust, extractFacts, highlightDisagreement } from "@/lib/trust";
import type { InfoWithRelations } from "@/lib/types";
import { Badge, formatDateTime } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { TrustFactors, TrustScore } from "@/components/trust-score";
import { SubmitButton } from "@/components/submit-button";
import { ExpertCard } from "@/components/expert-card";
import { resolveConflict } from "../../actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS = {
  pending: { label: "En attente de validation", tone: "warn" },
  accepted: { label: "Nouvelle info validée", tone: "good" },
  rejected: { label: "Nouvelle info rejetée", tone: "neutral" },
  obsolete: { label: "Sans objet", tone: "neutral" },
} as const;

export default async function ConflictPage(props: PageProps<"/conflicts/[id]">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, { employees, expertise }, canResolve] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
    supabase.rpc("can_resolve_conflict", { p_conflict_id: id }),
  ]);

  const conflict = conflicts.find((c) => c.id === id);
  const original = infos.find((i) => i.id === conflict?.original_info_id);
  const challenger = infos.find((i) => i.id === conflict?.challenger_info_id);
  if (!conflict || !original || !challenger) notFound();

  const index = buildConflictIndex(conflicts, infos);
  const trustOf = (info: InfoWithRelations) =>
    computeTrust(info, (index.get(info.id) ?? []).map((c) => c.other), info.client?.country ?? info.country);

  const factsA = extractFacts(original.content);
  const factsB = extractFacts(challenger.content);
  const onlyA = factsA.filter((f) => !factsB.includes(f));
  const onlyB = factsB.filter((f) => !factsA.includes(f));

  const assignee = employees.find((e) => e.id === conflict.assignee_id);
  const resolver = employees.find((e) => e.id === conflict.resolved_by);
  const status = STATUS[conflict.status];
  const allowed = canResolve.data === true;
  const experts = rankExperts(expertise, employees, { contextId: conflict.context_id, limit: 2 });

  return (
    <>
      <Link href="/conflicts" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Tous les conflits
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Scale className="h-6 w-6 text-red-500" /> Contradiction
            {original.context && <span className="text-slate-400">· {original.context.label}</span>}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Détectée le {formatDateTime(conflict.created_at)}
            {assignee && <> · à valider par <strong className="text-slate-700">{assignee.full_name}</strong></>}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {(onlyA.length > 0 || onlyB.length > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Point de désaccord :</span>
          <code className="rounded bg-white px-2 py-0.5 font-semibold text-red-700">{onlyA.join(", ") || "—"}</code>
          <span>contre</span>
          <code className="rounded bg-white px-2 py-0.5 font-semibold text-red-700">{onlyB.join(", ") || "—"}</code>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SourcePanel label="A · Source originale" info={original} otherText={challenger.content} trust={trustOf(original)} />
        <SourcePanel label="B · Nouvelle information" info={challenger} otherText={original.content} trust={trustOf(challenger)} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        {conflict.status !== "pending" ? (
          <p className="text-sm text-slate-600">
            Tranché{resolver ? ` par ${resolver.full_name}` : ""} le {formatDateTime(conflict.resolved_at)}.
          </p>
        ) : allowed ? (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Tu es autorisé·e à trancher. Ta décision met à jour la base, prévient l&apos;auteur de B et
              augmente ton score d&apos;expertise sur ce sujet.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <form action={resolveConflict} className="flex-1">
                <input type="hidden" name="conflict_id" value={conflict.id} />
                <input type="hidden" name="decision" value="accept" />
                <SubmitButton variant="success" className="w-full">
                  <Check className="h-4 w-4" /> Valider B : elle remplace A
                </SubmitButton>
              </form>
              <form action={resolveConflict} className="flex-1">
                <input type="hidden" name="conflict_id" value={conflict.id} />
                <input type="hidden" name="decision" value="reject" />
                <SubmitButton variant="secondary" className="w-full">
                  <X className="h-4 w-4" /> Rejeter B : garder A
                </SubmitButton>
              </form>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-600">
              Seuls l&apos;auteur de la source originale et l&apos;expert référent du sujet peuvent trancher.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {experts.map((x) => (
                <ExpertCard
                  key={x.employee.id}
                  expert={x.employee}
                  score={x.score}
                  authority={authorityOf(x.score)}
                  topic={original.context?.label ?? null}
                  handoffMessage={`Peux-tu trancher la contradiction entre « ${original.title} » et « ${challenger.title} » ?`}
                  contextId={conflict.context_id}
                  conflictId={conflict.id}
                  isMe={x.employee.id === employee?.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SourcePanel({
  label,
  info,
  otherText,
  trust,
}: {
  label: string;
  info: InfoWithRelations;
  otherText: string;
  trust: ReturnType<typeof computeTrust>;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
          <h2 className="mt-1 font-medium">{info.title}</h2>
          {info.source_label && <p className="mt-0.5 truncate text-xs text-slate-500">{info.source_label}</p>}
        </div>
        <TrustScore trust={trust} />
      </div>
      <p className="flex-1 p-5 leading-relaxed text-slate-800">
        {highlightDisagreement(info.content, otherText).map((seg, i) =>
          seg.mark ? (
            <mark key={i} className="rounded bg-red-100 px-1 font-semibold text-red-800">
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
      <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-5">
        <TrustPills info={info} />
        <TrustFactors trust={trust} />
      </div>
    </section>
  );
}
