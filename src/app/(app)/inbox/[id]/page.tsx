import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Search, X } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData, type NotificationItem } from "@/lib/data";
import { highlightDisagreement } from "@/lib/trust";
import type { Conflict, InfoWithRelations } from "@/lib/types";
import { Badge, Card, formatDateTime } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { TrustPills } from "@/components/trust-pills";
import { NOTIFICATION_TITLES } from "@/components/notification-row";
import { markNotificationDone, resolveConflict } from "../../actions";
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

  const isOpen = item.status === "open";
  const searchHref = `/search?${new URLSearchParams({
    ...(client ? { client: client.id } : {}),
    ...(context ? { context: context.id } : {}),
    q: context?.label ?? "",
  })}`;

  return (
    <div className="max-w-4xl">
      <Link href="/inbox" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Boîte de réception
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">{NOTIFICATION_TITLES[item.kind]}</h1>
          <Badge tone={isOpen ? "warn" : "good"}>{isOpen ? "À traiter" : "Traité"}</Badge>
          {client && <Badge tone="info">{client.name}</Badge>}
          {context && <Badge>{context.label}</Badge>}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {item.sender ? (
            <>
              De{" "}
              <Link href={`/team/${item.sender.id}`} className="font-medium text-indigo-600 hover:underline">
                {item.sender.full_name}
              </Link>{" "}
              ·{" "}
            </>
          ) : null}
          {formatDateTime(item.created_at)}
        </p>
        <p className="mt-4 whitespace-pre-line text-slate-800">{item.message}</p>
      </Card>

      {conflict && original && challenger && (
        <Card className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Contradiction à trancher</h2>
            <Link href={`/conflicts/${conflict.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
              Vue comparée complète <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Side label="A · Original" info={original} other={challenger} />
            <Side label="B · Nouvelle info" info={challenger} other={original} />
          </div>

          <div className="mt-4">
            {conflict.status !== "pending" ? (
              <p className="text-sm text-slate-600">Ce conflit a déjà été tranché.</p>
            ) : canResolve.data === true ? (
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
            ) : (
              <p className="text-sm text-slate-600">Tu n&apos;es pas autorisé·e à trancher ce conflit.</p>
            )}
          </div>
        </Card>
      )}

      {item.kind === "handoff" && !item.conflict_id && isOpen && (
        <Card className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Répondre à {item.sender?.full_name ?? "ton collègue"}</h2>
            <Link href={searchHref} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
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
        </Card>
      )}

      {isOpen && (
        <form action={markNotificationDone} className="mt-4">
          <input type="hidden" name="notification_id" value={item.id} />
          <SubmitButton variant="secondary">Marquer comme traité</SubmitButton>
        </form>
      )}
    </div>
  );
}

function Side({ label, info, other }: { label: string; info: InfoWithRelations; other: InfoWithRelations }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="mt-1 font-medium">{info.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">
        {highlightDisagreement(info.content, other.content).map((seg, i) =>
          seg.mark ? (
            <mark key={i} className="rounded bg-red-100 px-1 font-semibold text-red-800">
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
      <div className="mt-3">
        <TrustPills info={info} />
      </div>
    </div>
  );
}
