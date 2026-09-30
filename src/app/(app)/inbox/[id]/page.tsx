import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, ExternalLink, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData, type NotificationItem } from "@/lib/data";
import { KIND_META, describeNotification } from "@/lib/inbox";
import { highlightDisagreement } from "@/lib/trust";
import type { Conflict, InfoWithRelations } from "@/lib/types";
import { formatDate, formatDateTime } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { TrustPills } from "@/components/trust-pills";
import { markNotificationDone, resolveConflictFromInbox } from "../../actions";
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

  const [{ clients, contexts }, conflictRow, canResolve] = await Promise.all([
    fetchReferenceData(supabase),
    item.conflict_id
      ? supabase.from("conflicts").select("*").eq("id", item.conflict_id).maybeSingle()
      : Promise.resolve({ data: null }),
    item.conflict_id
      ? supabase.rpc("can_resolve_conflict", { p_conflict_id: item.conflict_id })
      : Promise.resolve({ data: false }),
  ]);
  const conflict = conflictRow.data as Conflict | null;
  const client = clients.find((c) => c.id === item.client_id) ?? null;
  const context = contexts.find((c) => c.id === (item.context_id ?? conflict?.context_id)) ?? null;

  let original: InfoWithRelations | undefined;
  let challenger: InfoWithRelations | undefined;
  if (conflict) {
    const infos = await fetchInfos(supabase);
    original = infos.find((i) => i.id === conflict.original_info_id);
    challenger = infos.find((i) => i.id === conflict.challenger_info_id);
  }

  const meta = KIND_META[item.kind];
  const { subject } = describeNotification(item, {
    clients: Object.fromEntries(clients.map((c) => [c.id, c.name])),
    contexts: Object.fromEntries(contexts.map((c) => [c.id, c.label])),
  });
  const isOpen = item.status === "open";
  const pending = conflict?.status === "pending";
  const canDecide = pending && canResolve.data === true;
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

        {/* Contradiction : choisir la bonne version */}
        {conflict && original && challenger && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">
                {pending ? "Quelle information est la bonne ?" : "Contradiction tranchée"}
              </h2>
              <Link href={`/conflicts/${conflict.id}`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline">
                Vue détaillée <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            {!pending && (
              <p className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                {conflict.status === "accepted" ? "La nouvelle version (B) a été retenue." : conflict.status === "rejected" ? "La version d'origine (A) a été conservée." : "Ce conflit est sans objet."}
              </p>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <Choice
                label="A · Version actuelle"
                info={original}
                other={challenger}
                conflictId={conflict.id}
                decision="reject"
                cta="A est correcte"
                hint="B sera rejetée"
                enabled={canDecide}
                kept={conflict.status === "rejected"}
              />
              <Choice
                label="B · Nouvelle version"
                info={challenger}
                other={original}
                conflictId={conflict.id}
                decision="accept"
                cta="B est correcte"
                hint="elle remplacera A"
                enabled={canDecide}
                kept={conflict.status === "accepted"}
              />
            </div>
            {canDecide && (
              <p className="mt-3 text-xs text-slate-500">
                Ta décision met la base à jour, prévient l&apos;auteur de B et augmente ton score d&apos;expertise sur ce sujet.
              </p>
            )}
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

function Choice(props: {
  label: string;
  info: InfoWithRelations;
  other: InfoWithRelations;
  conflictId: string;
  decision: "accept" | "reject";
  cta: string;
  hint: string;
  enabled: boolean;
  kept: boolean;
}) {
  const { info } = props;
  return (
    <div className={`flex flex-col rounded-xl border bg-white shadow-sm ${props.kept ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"}`}>
      <div className="border-b border-slate-100 px-5 py-3">
        <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{props.label}</p>
        <p className="mt-0.5 font-medium">{info.title}</p>
        <p className="text-xs text-slate-500">
          {info.owner?.full_name ?? "Sans auteur"} · {formatDate(info.source_updated_at)}
        </p>
      </div>
      <p className="flex-1 px-5 py-4 leading-relaxed text-slate-800">
        {highlightDisagreement(info.content, props.other.content).map((seg, i) =>
          seg.mark ? (
            <mark key={i} className="rounded bg-red-100 px-1 font-semibold text-red-800">
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
      <div className="px-5 pb-4">
        <TrustPills info={info} />
      </div>
      {props.enabled && (
        <form action={resolveConflictFromInbox} className="border-t border-slate-100 p-4">
          <input type="hidden" name="conflict_id" value={props.conflictId} />
          <input type="hidden" name="decision" value={props.decision} />
          <SubmitButton variant={props.decision === "accept" ? "success" : "primary"} className="w-full">
            <Check className="h-4 w-4" /> {props.cta}
            <span className="font-normal opacity-80">— {props.hint}</span>
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
