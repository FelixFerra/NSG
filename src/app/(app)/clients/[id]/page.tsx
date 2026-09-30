import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Mail, RotateCcw, Search, Users } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictGroups, buildConflictIndex, fetchClientIssues, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { computeTrust, extractFacts } from "@/lib/trust";
import { sourceName } from "@/lib/connectors";
import type { ClientIssue, Context, Employee, InfoWithRelations } from "@/lib/types";
import { Badge, Card, EmptyState, formatDate } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { SubmitButton } from "@/components/submit-button";
import { ClientForm } from "../client-form";
import { IssueForm } from "../issue-form";
import { setClientIssueStatus } from "../actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientPage(props: PageProps<"/clients/[id]">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase } = await getCurrentEmployee();
  const [infos, conflicts, issues, { clients, contexts, employees }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchClientIssues(supabase, id),
    fetchReferenceData(supabase),
  ]);
  const client = clients.find((c) => c.id === id);
  if (!client) notFound();

  const index = buildConflictIndex(conflicts, infos);
  const trustOf = (info: InfoWithRelations) =>
    computeTrust(info, (index.get(info.id) ?? []).map((c) => c.other), client.country);

  // Uniquement ce qui concerne ce client
  const specific = infos.filter((i) => i.client_id === client.id);
  const general = infos.filter((i) => !i.client_id && i.country === client.country && i.status === "active");
  const relatedIds = new Set(specific.map((i) => i.id));
  // Un groupe par sujet contesté (toutes les versions ensemble)
  const clientConflicts = buildConflictGroups(conflicts).filter(
    (g) => g.pending && g.infoIds.some((id) => relatedIds.has(id)),
  );
  const openIssues = issues.filter((i) => i.status === "open");
  const resolvedIssues = issues.filter((i) => i.status === "resolved");
  const owner = employees.find((e) => e.id === client.account_owner_id);
  const byId = new Map(infos.map((i) => [i.id, i]));

  return (
    <div className="max-w-5xl">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.country && <Badge>{client.country}</Badge>}
              {openIssues.length > 0 && <Badge tone="warn">{openIssues.length} problème(s) en cours</Badge>}
              {clientConflicts.length > 0 && <Badge tone="bad">{clientConflicts.length} conflit(s)</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">{client.sector ?? "Secteur non renseigné"}</p>
          </div>
          <Link
            href={`/search?client=${client.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Search className="h-4 w-4" /> Poser une question pour ce client
          </Link>
        </div>

        {client.description && <p className="mt-4 text-sm text-slate-700">{client.description}</p>}

        <dl className="mt-4 grid gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Responsable du compte</dt>
            <dd className="font-medium">
              {owner ? <Link href={`/team/${owner.id}`} className="text-indigo-600 hover:underline">{owner.full_name}</Link> : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Contact client</dt>
            <dd className="font-medium">
              {client.contact_name ?? "—"}
              {client.contact_email && (
                <a href={`mailto:${client.contact_email}`} className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-indigo-600 hover:underline">
                  <Mail className="h-3 w-3" /> {client.contact_email}
                </a>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Effectif</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <Users className="h-4 w-4 text-slate-400" /> {client.headcount ?? "—"}
            </dd>
          </div>
        </dl>

        <details className="mt-4 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-indigo-600">Modifier le profil</summary>
          <div className="mt-4">
            <ClientForm client={client} employees={employees} />
          </div>
        </details>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Problèmes en cours</h2>
          {openIssues.length === 0 ? (
            <p className="mb-3 text-sm text-slate-400">Aucun problème en cours.</p>
          ) : (
            <ul className="mb-4 space-y-3">
              {openIssues.map((issue) => (
                <IssueItem key={issue.id} issue={issue} clientId={client.id} contexts={contexts} employees={employees} />
              ))}
            </ul>
          )}
          <IssueForm clientId={client.id} contexts={contexts} />

          {resolvedIssues.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-slate-500">{resolvedIssues.length} problème(s) résolu(s)</summary>
              <ul className="mt-3 space-y-3">
                {resolvedIssues.map((issue) => (
                  <IssueItem key={issue.id} issue={issue} clientId={client.id} contexts={contexts} employees={employees} />
                ))}
              </ul>
            </details>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Conflits sur ses documents</h2>
          {clientConflicts.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune contradiction en attente.</p>
          ) : (
            <ul className="space-y-2">
              {clientConflicts.map((g) => (
                <li key={g.key}>
                  <Link href={`/conflicts/${g.key}`} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 hover:bg-red-100">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                    <span className="min-w-0 flex-1 truncate">
                      <strong>{contexts.find((x) => x.id === g.contextId)?.label ?? "Sujet"}</strong> : {g.infoIds.length} versions (
                      {g.infoIds.map((id) => extractFacts(byId.get(id)?.content ?? "").join(", ") || "?").join(" / ")})
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-1 font-medium">Documents du client</h2>
        <p className="mb-4 text-sm text-slate-500">Uniquement les infos propres à {client.name}.</p>
        {specific.length === 0 ? (
          <EmptyState>Aucun document spécifique à ce client.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {specific.map((info) => (
              <DocItem key={info.id} info={info} score={trustOf(info).score} />
            ))}
          </ul>
        )}

        {general.length > 0 && (
          <details className="mt-5 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-600">
              {general.length} règle(s) générale(s) applicable(s) en {client.country}
            </summary>
            <ul className="mt-3 space-y-3">
              {general.map((info) => (
                <DocItem key={info.id} info={info} score={trustOf(info).score} />
              ))}
            </ul>
          </details>
        )}
      </Card>
    </div>
  );
}

function IssueItem({
  issue,
  clientId,
  contexts,
  employees,
}: {
  issue: ClientIssue;
  clientId: string;
  contexts: Context[];
  employees: Employee[];
}) {
  const context = contexts.find((c) => c.id === issue.context_id);
  const author = employees.find((e) => e.id === issue.created_by);
  const open = issue.status === "open";
  const searchHref = `/search?${new URLSearchParams({ client: clientId, ...(context ? { context: context.id } : {}), q: issue.title })}`;

  return (
    <li className={`rounded-lg border p-3 ${open ? "border-amber-200 bg-amber-50/50" : "border-slate-200 opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{issue.title}</p>
        {context && <Badge tone="info">{context.label}</Badge>}
      </div>
      {issue.description && <p className="mt-1 text-sm text-slate-600">{issue.description}</p>}
      <p className="mt-1 text-xs text-slate-400">
        {author ? `${author.full_name} · ` : ""}
        {formatDate(issue.created_at)}
        {issue.resolved_at ? ` · résolu le ${formatDate(issue.resolved_at)}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {open && (
          <Link href={searchHref} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
            <Search className="h-3.5 w-3.5" /> Chercher une réponse
          </Link>
        )}
        <form action={setClientIssueStatus}>
          <input type="hidden" name="issue_id" value={issue.id} />
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="status" value={open ? "resolved" : "open"} />
          <SubmitButton variant="secondary" className="px-2 py-1 text-xs">
            {open ? <><CheckCircle2 className="h-3.5 w-3.5" /> Marquer résolu</> : <><RotateCcw className="h-3.5 w-3.5" /> Rouvrir</>}
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

function DocItem({ info, score }: { info: InfoWithRelations; score: number }) {
  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{info.title}</p>
          <p className="mt-1 text-sm text-slate-600">{info.content}</p>
          <p className="mt-1 text-xs text-slate-400">
            {info.context?.label ?? "—"} · {sourceName(info.source_type)}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{score}/100</span>
      </div>
      <div className="mt-2">
        <TrustPills info={info} />
      </div>
    </li>
  );
}
