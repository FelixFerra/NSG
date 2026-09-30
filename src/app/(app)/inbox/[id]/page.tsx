import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import {
  buildConflictGroups,
  fetchConflicts,
  fetchInfos,
  fetchReferenceData,
  groupIndex,
  type NotificationItem,
} from "@/lib/data";
import { KIND_META, describeNotification } from "@/lib/inbox";
import { formatDateTime } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { VersionChooser } from "@/components/version-chooser";
import { markNotificationDone, resolveConflictGroupFromInbox } from "../../actions";
import { AnswerForm } from "./answer-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NotificationPage(props: PageProps<"/inbox/[id]">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase } = await getCurrentEmployee();
  // RLS : on ne peut ouvrir que ses propres notifications
  const { data } = await supabase
    .from("notifications")
    .select("*, sender:employees!notifications_sender_id_fkey(id, full_name), conflict:conflicts(id, status)")
    .eq("id", id)
    .maybeSingle();
  const item = data as NotificationItem | null;
  if (!item) notFound();

  // Ouvrir une notification la marque comme lue ; une simple réponse est alors traitée
  if (!item.read_at || (item.kind === "resolution" && item.status === "open")) {
    const now = new Date().toISOString();
    await supabase
      .from("notifications")
      .update(item.kind === "resolution" ? { read_at: item.read_at ?? now, status: "done" } : { read_at: now })
      .eq("id", item.id);
    if (item.kind === "resolution") item.status = "done";
  }

  const [{ clients, contexts }, conflicts, infos, canResolve] = await Promise.all([
    fetchReferenceData(supabase),
    fetchConflicts(supabase),
    fetchInfos(supabase),
    item.conflict_id
      ? supabase.rpc("can_resolve_conflict", { p_conflict_id: item.conflict_id })
      : Promise.resolve({ data: false }),
  ]);
  // Le conflit de la notification + tous ceux du même groupe (mêmes documents)
  const group = item.conflict_id ? groupIndex(buildConflictGroups(conflicts)).get(item.conflict_id) ?? null : null;
  const byId = new Map(infos.map((i) => [i.id, i]));
  const versions = (group?.infoIds ?? []).map((v) => byId.get(v)).filter((v) => v !== undefined);
  const client = clients.find((c) => c.id === item.client_id) ?? versions.find((v) => v.client)?.client ?? null;
  const context = contexts.find((c) => c.id === (item.context_id ?? group?.contextId)) ?? null;

  const meta = KIND_META[item.kind];
  const { subject } = describeNotification(item, {
    clients: Object.fromEntries(clients.map((c) => [c.id, c.name])),
    contexts: Object.fromEntries(contexts.map((c) => [c.id, c.label])),
  });
  const isOpen = item.status === "open";
  const canDecide = !!group?.pending && canResolve.data === true;
  const searchHref = `/search?${new URLSearchParams({
    ...(client ? { client: client.id } : {}),
    ...(context ? { context: context.id } : {}),
    q: subject,
  })}`;

  return (
    <article className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4 md:px-8">
        <Link href="/inbox" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 md:hidden">
          <ArrowLeft className="h-4 w-4" /> Boîte de réception
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${meta.pill}`}>{meta.label}</span>
              <span className={isOpen ? "font-medium text-amber-700" : "text-emerald-700"}>{isOpen ? "À traiter" : "Traité"}</span>
            </div>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight">{subject}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {item.sender ? (
                <>
                  <Link href={`/team/${item.sender.id}`} className="font-medium text-slate-700 hover:text-indigo-700 hover:underline">
                    {item.sender.full_name}
                  </Link>
                  {" · "}
                </>
              ) : null}
              {formatDateTime(item.created_at)}
              {client && (
                <>
                  {" · "}
                  <Link href={`/clients/${client.id}`} className="hover:text-indigo-700 hover:underline">{client.name}</Link>
                </>
              )}
              {context && ` · ${context.label}`}
            </p>
          </div>
          {isOpen && !canDecide && (
            <form action={markNotificationDone} className="shrink-0">
              <input type="hidden" name="notification_id" value={item.id} />
              <SubmitButton variant="secondary" className="text-xs">
                <Check className="h-3.5 w-3.5" /> Marquer traité
              </SubmitButton>
            </form>
          )}
        </div>
      </header>

      <div className="max-w-4xl space-y-6 px-5 py-6 md:px-8">
        {/* Message du collègue (question ou réponse) */}
        {item.kind !== "review_request" && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 whitespace-pre-line text-slate-800 shadow-sm">
            {item.message}
          </div>
        )}

        {/* Contradiction : toutes les versions du groupe, choisir la bonne */}
        {group && versions.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">
                {group.pending ? `Quelle version est la bonne ? (${versions.length} versions)` : "Contradiction tranchée"}
              </h2>
              <Link href={`/conflicts/${group.key}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                Vue détaillée <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <VersionChooser
              conflictId={item.conflict_id!}
              versions={versions}
              pending={group.pending}
              canDecide={canDecide}
              action={resolveConflictGroupFromInbox}
              country={client?.country}
            />
          </section>
        )}
        {/* Question sans conflit : y répondre */}
        {item.kind === "handoff" && !item.conflict_id && isOpen && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Répondre à {item.sender?.full_name ?? "ton collègue"}</h2>
              <Link href={searchHref} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                <Search className="h-4 w-4" /> Chercher dans la base
              </Link>
            </div>
            <AnswerForm
              notificationId={item.id}
              clientId={client?.id ?? null}
              contextId={context?.id ?? null}
              country={client?.country ?? null}
              contexts={contexts}
            />
          </section>
        )}
      </div>
    </article>
  );
}
