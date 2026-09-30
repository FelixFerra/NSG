import Link from "next/link";
import { Scale, Send, CheckCheck } from "lucide-react";
import type { NotificationItem } from "@/lib/data";
import { formatDateTime } from "./ui";

const ICONS = { review_request: Scale, handoff: Send, resolution: CheckCheck };

export const NOTIFICATION_TITLES = {
  review_request: "Ton travail est remis en cause",
  handoff: "On te demande de l'aide",
  resolution: "Réponse / décision",
} as const;

/** Ligne cliquable : ouvre la notification pour la traiter directement. */
export function NotificationRow({ item, compact = false }: { item: NotificationItem; compact?: boolean }) {
  const Icon = ICONS[item.kind];
  const toHandle = item.status === "open" && item.kind !== "resolution";
  return (
    <Link
      href={`/inbox/${item.id}`}
      className={`flex gap-3 px-4 py-3 hover:bg-slate-50 ${item.read_at && !toHandle ? "opacity-60" : ""}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toHandle ? "text-red-500" : "text-indigo-500"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{NOTIFICATION_TITLES[item.kind]}</p>
          {!item.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
        </div>
        <p className={`mt-0.5 text-sm text-slate-600 ${compact ? "line-clamp-2" : "line-clamp-3"} whitespace-pre-line`}>
          {item.message}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {item.sender?.full_name ? `${item.sender.full_name} · ` : ""}
          {formatDateTime(item.created_at)}
          {toHandle ? " · à traiter" : item.status === "done" && item.kind !== "resolution" ? " · traité" : ""}
        </p>
      </div>
    </Link>
  );
}
