import Link from "next/link";
import { Bell, Check, X, Scale, Send, CheckCheck } from "lucide-react";
import type { Conflict, Notification } from "@/lib/types";
import { markNotificationRead, resolveConflict } from "@/app/(app)/actions";
import { Popover } from "./popover";
import { SubmitButton } from "./submit-button";
import { formatDateTime } from "./ui";

type Item = Notification & { sender: { full_name: string } | null; conflict: Pick<Conflict, "id" | "status"> | null };

const ICONS = { review_request: Scale, handoff: Send, resolution: CheckCheck };
const TITLES = {
  review_request: "Ton travail est remis en cause",
  handoff: "Demande d'aide",
  resolution: "Décision sur ta contribution",
};

export function NotificationCenter({ items }: { items: Item[] }) {
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover
      trigger={
        <span className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unread}
            </span>
          )}
          <span className="sr-only">{unread} notification(s) non lue(s)</span>
        </span>
      }
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold">Demandes d&apos;examen</p>
        <p className="text-xs text-slate-500">{unread ? `${unread} en attente` : "Tout est à jour"}</p>
      </div>
      <ul className="max-h-[28rem] overflow-y-auto">
        {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification.</li>}
        {items.map((n) => {
          const Icon = ICONS[n.kind];
          const pendingReview = n.kind === "review_request" && n.conflict?.status === "pending";
          return (
            <li key={n.id} className={`border-b border-slate-100 px-4 py-3 last:border-0 ${n.read_at ? "opacity-60" : ""}`}>
              <div className="flex gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${pendingReview ? "text-red-500" : "text-indigo-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{TITLES[n.kind]}</p>
                  <p className="mt-0.5 text-sm whitespace-pre-line text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {n.sender?.full_name ? `${n.sender.full_name} · ` : ""}
                    {formatDateTime(n.created_at)}
                  </p>

                  {pendingReview && n.conflict && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={resolveConflict}>
                        <input type="hidden" name="conflict_id" value={n.conflict.id} />
                        <input type="hidden" name="decision" value="accept" />
                        <SubmitButton variant="success" className="px-2.5 py-1 text-xs">
                          <Check className="h-3.5 w-3.5" /> Valider
                        </SubmitButton>
                      </form>
                      <form action={resolveConflict}>
                        <input type="hidden" name="conflict_id" value={n.conflict.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <SubmitButton variant="secondary" className="px-2.5 py-1 text-xs">
                          <X className="h-3.5 w-3.5" /> Rejeter
                        </SubmitButton>
                      </form>
                      <Link href={`/conflicts/${n.conflict.id}`} className="px-1 py-1 text-xs font-medium text-indigo-600 hover:underline">
                        Comparer
                      </Link>
                    </div>
                  )}

                  {!n.read_at && !pendingReview && (
                    <form action={markNotificationRead} className="mt-1">
                      <input type="hidden" name="notification_id" value={n.id} />
                      <button className="text-xs text-slate-500 hover:text-slate-900">Marquer comme lu</button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
