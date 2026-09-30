import Link from "next/link";
import { Bell } from "lucide-react";
import type { NotificationItem } from "@/lib/data";
import { Popover } from "./popover";
import { NotificationRow } from "./notification-row";

export function NotificationCenter({ items }: { items: NotificationItem[] }) {
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
        <p className="text-sm font-semibold">Notifications</p>
        <p className="text-xs text-slate-500">Clique pour traiter maintenant, ou retrouve-les plus tard dans ta boîte.</p>
      </div>
      <ul className="max-h-104 overflow-y-auto">
        {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">Rien de nouveau.</li>}
        {items.map((n) => (
          <li key={n.id} className="border-b border-slate-100 last:border-0">
            <NotificationRow item={n} compact />
          </li>
        ))}
      </ul>
      <Link href="/inbox" className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-indigo-600 hover:bg-slate-50">
        Ouvrir la boîte de réception
      </Link>
    </Popover>
  );
}
