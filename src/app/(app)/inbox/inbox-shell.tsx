"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { NotificationItem } from "@/lib/data";
import { KIND_META, describeNotification } from "@/lib/inbox";
import { markAllNotificationsRead } from "../actions";

type Kind = NotificationItem["kind"];

/** À traiter = une action est attendue ; une réponse non lue compte aussi. */
function needsAttention(n: NotificationItem, seen: boolean) {
  if (n.kind === "resolution") return !n.read_at && !seen;
  return n.status === "open";
}

function shortTime(iso: string) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("fr-BE", sameDay ? { timeStyle: "short" } : { day: "numeric", month: "short" }).format(d);
}

export function InboxShell({
  items,
  clientNames,
  contextLabels,
  children,
}: {
  items: NotificationItem[];
  clientNames: Record<string, string>;
  contextLabels: Record<string, string>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const selectedId = pathname.startsWith("/inbox/") ? pathname.split("/")[2] : null;
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  // Éléments ouverts pendant la session : lus sans recharger la liste
  const [seen, setSeen] = useState<Set<string>>(new Set());
  if (selectedId && !seen.has(selectedId)) setSeen(new Set(seen).add(selectedId));

  const names = { clients: clientNames, contexts: contextLabels };
  const isUnread = (n: NotificationItem) => !n.read_at && !seen.has(n.id);

  const todoCount = useMemo(() => items.filter((n) => needsAttention(n, seen.has(n.id))).length, [items, seen]);
  const q = query.trim().toLowerCase();
  const visible = items
    .filter((n) => (needsAttention(n, seen.has(n.id)) ? "todo" : "done") === tab)
    .filter((n) => kind === "all" || n.kind === kind)
    .filter((n) => !q || `${n.message} ${n.sender?.full_name ?? ""}`.toLowerCase().includes(q));

  return (
    <div className="-mx-4 -my-4 flex min-h-[70vh] bg-white md:-mx-10 md:-my-6 md:h-screen">
      {/* Liste */}
      <section className={`w-full flex-col border-r border-slate-200 md:flex md:w-104 md:shrink-0 ${selectedId ? "hidden" : "flex"}`}>
        <header className="border-b border-slate-200 px-5 pt-5">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Boîte de réception</h1>
            {items.some(isUnread) && (
              <form action={markAllNotificationsRead}>
                <button className="text-xs text-slate-500 hover:text-slate-900">Tout marquer comme lu</button>
              </form>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Rechercher</span>
              <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher"
                className="w-full rounded-md bg-slate-100 py-1.5 pr-3 pl-8 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-200"
              />
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind | "all")}
              aria-label="Type"
              className="rounded-md bg-slate-100 px-2 py-1.5 text-sm text-slate-700 outline-none"
            >
              <option value="all">Tout</option>
              {(Object.keys(KIND_META) as Kind[]).map((k) => (
                <option key={k} value={k}>{KIND_META[k].plural}</option>
              ))}
            </select>
          </div>

          <nav className="mt-3 flex gap-5 text-sm">
            {(["todo", "done"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 pb-2.5 ${tab === t ? "border-indigo-600 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
              >
                {t === "todo" ? "À traiter" : "Traité"}
                {t === "todo" && todoCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">{todoCount}</span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <ul className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <li className="px-6 py-16 text-center">
              <p className="font-medium text-slate-700">{tab === "todo" ? "Tout est traité" : "Rien ici"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {tab === "todo" ? "Les validations et questions qui te concernent arriveront ici." : "Les éléments traités apparaîtront ici."}
              </p>
            </li>
          )}
          {visible.map((n) => {
            const meta = KIND_META[n.kind];
            const { subject, preview } = describeNotification(n, names);
            const unread = isUnread(n);
            const selected = n.id === selectedId;
            return (
              <li key={n.id}>
                <Link
                  href={`/inbox/${n.id}`}
                  className={`block border-b border-l-4 border-b-slate-100 px-4 py-3 ${
                    tab === "todo" ? meta.bar : "border-l-transparent"
                  } ${selected ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={`font-medium ${meta.text}`}>{meta.label}</span>
                    <span className="text-slate-400">{shortTime(n.created_at)}</span>
                  </div>
                  <p className={`mt-0.5 flex items-center gap-2 text-sm ${unread ? "font-semibold text-slate-900" : "text-slate-800"}`}>
                    <span className="truncate">{subject}</span>
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Non lu" />}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {n.sender?.full_name ? <span className="text-slate-600">{n.sender.full_name} — </span> : null}
                    {preview}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Détail */}
      <section className={`min-w-0 flex-1 overflow-y-auto bg-slate-50 md:block ${selectedId ? "block" : "hidden"}`}>
        {children}
      </section>
    </div>
  );
}
