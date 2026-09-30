import Link from "next/link";
import { ArrowUpRight, Check, CheckCheck, CheckCircle2, MessageCircleQuestion, Scale, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import {
  buildConflictGroups,
  fetchConflicts,
  fetchInfos,
  fetchNotifications,
  fetchReferenceData,
  groupIndex,
  type ConflictGroup,
  type NotificationItem,
} from "@/lib/data";
import { computeTrust, extractFacts } from "@/lib/trust";
import { sourceName } from "@/lib/connectors";
import type { InfoWithRelations } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";
import { ScoreBadge } from "@/components/trust-score";
import { formatDate, formatDateTime } from "@/components/ui";
import { markNotificationDone, resolveConflictGroup } from "../actions";
import { AnswerForm } from "./answer-form";

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

export default async function InboxPage(props: PageProps<"/inbox">) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === "history" ? "history" : "todo";

  const { supabase, employee } = await getCurrentEmployee();
  const [notifications, conflicts, infos, { clients, contexts }] = await Promise.all([
    fetchNotifications(supabase),
    fetchConflicts(supabase),
    fetchInfos(supabase),
    fetchReferenceData(supabase),
  ]);

  // Ouvrir la boîte marque les nouveautés comme vues
  const unseen = notifications.filter((n) => !n.read_at).map((n) => n.id);
  if (unseen.length > 0) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unseen);
  }
  const isNew = (n: NotificationItem) => unseen.includes(n.id);

  const groups = groupIndex(buildConflictGroups(conflicts));
  const byInfo = new Map(infos.map((i) => [i.id, i]));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? null;
  const contextLabel = (id: string | null) => contexts.find((c) => c.id === id)?.label ?? null;

  const open = notifications.filter((n) => n.status === "open");

  // 1. Contradictions : une tâche par groupe de conflits en attente
  const conflictTasks = new Map<string, { group: ConflictGroup; requests: NotificationItem[] }>();
  for (const n of open) {
    const group = n.conflict_id ? groups.get(n.conflict_id) : undefined;
    if (!group?.pending) continue;
    const task = conflictTasks.get(group.key) ?? { group, requests: [] };
    task.requests.push(n);
    conflictTasks.set(group.key, task);
  }
  // 2. Questions sans conflit
  const questions = open.filter((n) => n.kind === "handoff" && !n.conflict_id);
  // 3. Réponses et décisions reçues
  const replies = open.filter((n) => n.kind === "resolution");

  const todo = conflictTasks.size + questions.length;
  const history = notifications.filter((n) => n.status === "done");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Boîte de réception</h1>
          <p className="mt-1 text-sm text-slate-500">
            {todo === 0
              ? "Rien à traiter pour le moment."
              : `${todo} tâche${todo > 1 ? "s" : ""} à traiter : tout se fait ici, sans changer de page.`}
          </p>
        </div>
        <nav className="flex rounded-lg bg-slate-100 p-1 text-sm">
          <TabLink href="/inbox" active={tab === "todo"}>
            À traiter {todo > 0 && <span className="ml-1 rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">{todo}</span>}
          </TabLink>
          <TabLink href="/inbox?tab=history" active={tab === "history"}>Historique</TabLink>
        </nav>
      </div>

      {searchParams.done === "1" && (
        <p className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" /> Réponse envoyée : ton collègue a été prévenu.
        </p>
      )}

      {tab === "history" ? (
        <HistoryList items={history} />
      ) : (
        <div className="space-y-10">
          {todo === 0 && replies.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 font-medium">Tout est traité</p>
              <p className="mt-1 text-sm text-slate-500">
                Les contradictions sur tes infos et les questions de tes collègues arriveront ici.
              </p>
            </div>
          )}

          {conflictTasks.size > 0 && (
            <Section icon={Scale} tone="text-red-600" title="Contradictions à trancher" count={conflictTasks.size}
              hint="Plusieurs sources disent autre chose : choisis la version correcte, les autres seront archivées ou rejetées.">
              {[...conflictTasks.values()].map(({ group, requests }) => (
                <ConflictTask
                  key={group.key}
                  group={group}
                  requests={requests}
                  versions={group.infoIds.map((id) => byInfo.get(id)).filter((v) => v !== undefined)}
                  context={contextLabel(group.contextId)}
                  isNew={requests.some(isNew)}
                  meId={employee?.id}
                />
              ))}
            </Section>
          )}

          {questions.length > 0 && (
            <Section icon={MessageCircleQuestion} tone="text-amber-600" title="Questions de collègues" count={questions.length}
              hint="On te demande ton expertise. Ta réponse peut aussi enrichir la base.">
              {questions.map((n) => (
                <QuestionTask
                  key={n.id}
                  item={n}
                  client={clients.find((c) => c.id === n.client_id) ?? null}
                  context={contextLabel(n.context_id)}
                  contexts={contexts}
                  isNew={isNew(n)}
                  clientLabel={clientName(n.client_id)}
                />
              ))}
            </Section>
          )}

          {replies.length > 0 && (
            <Section icon={CheckCheck} tone="text-emerald-600" title="Réponses et décisions" count={replies.length}>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {replies.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                    <Avatar name={n.sender?.full_name} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm whitespace-pre-line text-slate-800">{n.message}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {n.sender?.full_name ?? "Système"} · {ago(n.created_at)}
                        {isNew(n) && <NewDot />}
                      </p>
                    </div>
                    <form action={markNotificationDone}>
                      <input type="hidden" name="notification_id" value={n.id} />
                      <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">
                        <Check className="h-3.5 w-3.5" /> OK
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function ConflictTask({
  group,
  requests,
  versions,
  context,
  isNew,
  meId,
}: {
  group: ConflictGroup;
  requests: NotificationItem[];
  versions: InfoWithRelations[];
  context: string | null;
  isNew: boolean;
  meId?: string;
}) {
  const sorted = [...versions].sort((a, b) => b.source_updated_at.localeCompare(a.source_updated_at));
  const client = sorted.find((v) => v.client)?.client ?? null;
  const senders = [...new Set(requests.map((r) => r.sender?.full_name).filter(Boolean))];
  const handoff = requests.find((r) => r.kind === "handoff");

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {context ?? "Contradiction"}
            {client && <span className="font-normal text-slate-500">· {client.name}</span>}
            {isNew && <NewDot />}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {sorted.length} versions en désaccord
            {senders.length > 0 && <> · signalé par {senders.join(", ")}</>}
            {" · "}
            {ago(group.createdAt)}
          </p>
          {handoff && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm whitespace-pre-line text-amber-900">{handoff.message}</p>
          )}
        </div>
        <Link href={`/conflicts/${group.key}`} className="inline-flex shrink-0 items-center gap-1 text-sm text-slate-500 hover:text-indigo-700">
          Comparer en détail <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      <ul className="divide-y divide-slate-100">
        {sorted.map((v) => {
          const others = sorted.filter((o) => o.id !== v.id);
          const facts = extractFacts(v.content);
          const otherFacts = new Set(others.flatMap((o) => extractFacts(o.content)));
          const trust = computeTrust(v, others, v.client?.country ?? v.country);
          return (
            <li key={v.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[6rem_1fr_auto] sm:items-center">
              <div className="flex flex-wrap gap-1">
                {facts.length ? (
                  facts.map((f) => (
                    <span
                      key={f}
                      className={`rounded-md px-2 py-1 text-sm font-bold tabular-nums ${otherFacts.has(f) ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-700"}`}
                    >
                      {f.replace(/j$/, " j").replace(/m$/, " mois")}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{v.title}</span>
                  {v.employee_id === meId && <span className="shrink-0 rounded bg-indigo-50 px-1.5 text-xs text-indigo-700">ta version</span>}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{v.content}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span>{sourceName(v.source_type)}</span>·<span>{v.owner?.full_name ?? <span className="text-red-600">sans auteur</span>}</span>·
                  <span>{formatDate(v.source_updated_at)}</span>
                  {v.is_official && <span className="text-emerald-700">· officiel</span>}
                  {v.is_signed && <span className="text-emerald-700">· signé</span>}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                <ScoreBadge trust={trust} />
                <form action={resolveConflictGroup}>
                  <input type="hidden" name="conflict_id" value={group.key} />
                  <input type="hidden" name="winner_info_id" value={v.id} />
                  <SubmitButton variant="success" className="px-3 py-1.5 text-xs whitespace-nowrap">
                    <Check className="h-3.5 w-3.5" /> C&apos;est la bonne
                  </SubmitButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function QuestionTask({
  item,
  client,
  context,
  contexts,
  isNew,
  clientLabel,
}: {
  item: NotificationItem;
  client: { id: string; country: string | null } | null;
  context: string | null;
  contexts: Parameters<typeof AnswerForm>[0]["contexts"];
  isNew: boolean;
  clientLabel: string | null;
}) {
  const lines = item.message.split("\n").map((l) => l.trim()).filter(Boolean);
  const question = (lines[0] ?? "").replace(/^Question\s*:\s*/i, "");
  const details = lines.slice(1).filter((l) => !/^Client\s*:/i.test(l));
  const searchHref = `/search?${new URLSearchParams({
    ...(client ? { client: client.id } : {}),
    ...(item.context_id ? { context: item.context_id } : {}),
    q: question,
  })}`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar name={item.sender?.full_name} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            {item.sender ? (
              <Link href={`/team/${item.sender.id}`} className="font-medium text-slate-700 hover:underline">{item.sender.full_name}</Link>
            ) : (
              "Un collègue"
            )}{" "}
            te demande · {ago(item.created_at)}
            {isNew && <NewDot />}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">{question}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {clientLabel && <Tag>{clientLabel}</Tag>}
            {context && <Tag>{context}</Tag>}
          </div>
          {details.length > 0 && <p className="mt-2 text-sm text-slate-600">{details.join(" ")}</p>}
        </div>
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white group-open:hidden hover:bg-indigo-500">Répondre</span>
          <span className="hidden rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 group-open:inline">Annuler</span>
          <Link href={searchHref} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:text-indigo-700">
            <Search className="h-4 w-4" /> Chercher dans la base
          </Link>
        </summary>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <AnswerForm
            notificationId={item.id}
            clientId={client?.id ?? null}
            contextId={item.context_id}
            country={client?.country ?? null}
            contexts={contexts}
          />
        </div>
      </details>

      <form action={markNotificationDone} className="mt-3 text-right">
        <input type="hidden" name="notification_id" value={item.id} />
        <button className="text-xs text-slate-400 hover:text-slate-700">Marquer comme traité sans répondre</button>
      </form>
    </article>
  );
}

function HistoryList({ items }: { items: NotificationItem[] }) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">Aucun élément traité pour l&apos;instant.</p>;
  }
  const LABEL = { review_request: "Contradiction", handoff: "Question", resolution: "Réponse" } as const;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {items.map((n) => (
        <li key={n.id} className="flex items-start gap-3 px-4 py-3 text-sm">
          <span className="mt-0.5 w-24 shrink-0 text-xs font-medium text-slate-500">{LABEL[n.kind]}</span>
          <p className="min-w-0 flex-1 truncate text-slate-700" title={n.message}>{n.message.split("\n")[0]}</p>
          <span className="shrink-0 text-xs text-slate-400">{formatDateTime(n.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  icon: Icon,
  tone,
  title,
  count,
  hint,
  children,
}: {
  icon: typeof Scale;
  tone: string;
  title: string;
  count: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-700 uppercase">
          <Icon className={`h-4 w-4 ${tone}`} /> {title}
          <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-700">{count}</span>
        </h2>
        {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-md px-3 py-1.5 ${active ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
      {children}
    </Link>
  );
}

function Avatar({ name }: { name?: string | null }) {
  const initials = (name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
      {initials}
    </span>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{children}</span>;
}

function NewDot() {
  return <span className="ml-1.5 inline-flex items-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white uppercase">Nouveau</span>;
}
