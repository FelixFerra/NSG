"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import type { NotificationItem } from "@/lib/data";
import { KIND_META } from "@/lib/inbox";
import { markAllNotificationsRead } from "../actions";

type Kind = NotificationItem["kind"];

/** À traiter = une action est attendue ; une simple réponse non lue compte aussi. */
function needsAttention(n: NotificationItem, seen: boolean) {
  if (n.kind === "resolution") return !n.read_at && !seen;
  return n.status === "open";
}

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  if (diff < 7) return "Cette semaine";
  return "Plus ancien";
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
  // Éléments ouverts pendant la session : considérés comme lus sans recharger la liste
  const [seen, setSeen] = useState<Set<string>>(new Set());
  if (selectedId && !seen.has(selectedId)) setSeen(new Set(seen).add(selectedId));

  const isUnread = (n: NotificationItem) => !n.read_at && !seen.has(n.id);
  const inTab = (n: NotificationItem) => (needsAttention(n, seen.has(n.id)) ? "todo" : "done") === tab;

  const counts = useMemo(() => {
    const byKind = { all: 0, review_request: 0, handoff: 0, resolution: 0 };
    let todo = 0;
    for (const n of items) {
      if (needsAttention(n, seen.has(n.id))) {
        todo++;
        byKind.all++;
        byKind[n.kind]++;
      }
    }
    return { todo, done: items.length - todo, byKind };
  }, [items, seen]);

  const q = query.trim().toLowerCase();
  const visible = items
    .filter(inTab)
    .filter((n) => kind === "all" || n.kind === kind)
    .filter((n) => !q || `${n.message} ${n.sender?.full_name ?? ""}`.toLowerCase().includes(q));

  const groups = new Map<string, NotificationItem[]>();
  for (const n of visible) {
    const g = dayGroup(n.created_at);
    groups.set(g, [...(groups.get(g) ?? []), n]);
  }
  const unreadCount = items.filter(isUnread).length;

  return (
    <div className="-mx-4 -my-4 flex min-h-[70vh] border-t border-slate-200 bg-white md:-mx-10 md:-my-6 md:h-screen md:border-t-0">
      {/* Liste */}
      <section className={`flex w-full flex-col border-r border-slate-200 md:w-96 md:shrink-0 ${selectedId ? "hidden md:flex" : "flex"}`}>
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Inbox className="h-5 w-5 text-indigo-600" /> Boîte de réception
            </h1>
            {unreadCount > 0 && (
              <form action={markAllNotificationsRead}>
                <button className="text-xs font-medium text-indigo-600 hover:underline">Tout marquer comme lu</button>
              </form>
            )}
          </div>

          <div className="mt-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
            {(["todo", "done"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 ${tab === t ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              >
                {t === "todo" ? `À traiter (${counts.todo})` : `Traité (${counts.done})`}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip active={kind === "all"} onClick={() => setKind("all")} label="Tout" count={tab === "todo" ? counts.byKind.all : undefined} />
            {(Object.keys(KIND_META) as Kind[]).map((k) => (
              <Chip
                key={k}
                active={kind === k}
                onClick={() => setKind(k)}
                label={KIND_META[k].plural}
                count={tab === "todo" ? counts.byKind[k] : undefined}
              />
            ))}
          </div>

          <label className="relative mt-3 block">
            <span className="sr-only">Rechercher dans la boîte</span>
            <Search className="pointer-events-none absolute top-2 left-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full rounded-md border border-slate-200 py-1.5 pr-3 pl-8 text-sm outline-none focus:border-indigo-400"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              {tab === "todo" ? "Rien à traiter. Bravo !" : "Aucun élément."}
            </p>
          ) : (
            [...groups.entries()].map(([group, list]) => (
              <div key={group}>
                <p className="sticky top-0 bg-slate-50/95 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase backdrop-blur">
                  {group}
                </p>
                <ul>
                  {list.map((n) => {
                    const meta = KIND_META[n.kind];
                    const Icon = meta.icon;
                    const unread = isUnread(n);
                    const tags = [n.client_id && clientNames[n.client_id], n.context_id && contextLabels[n.context_id]].filter(Boolean);
                    return (
                      <li key={n.id}>
                        <Link
                          href={`/inbox/${n.id}`}
                          className={`flex gap-3 border-b border-slate-100 px-4 py-3 ${
                            n.id === selectedId ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.color}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`truncate text-sm ${unread ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                                {n.sender?.full_name ?? "Système"}
                              </p>
                              <span className="shrink-0 text-xs text-slate-400">{shortTime(n.created_at)}</span>
                            </div>
                            <p className={`text-xs ${unread ? "font-medium text-slate-700" : "text-slate-500"}`}>{meta.label}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{n.message}</p>
                            {tags.length > 0 && (
                              <p className="mt-1 flex flex-wrap gap-1">
                                {tags.map((t) => (
                                  <span key={t as string} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                                    {t}
                                  </span>
                                ))}
                              </p>
                            )}
                          </div>
                          {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-label="Non lu" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Détail */}
      <section className={`min-w-0 flex-1 overflow-y-auto bg-slate-50 ${selectedId ? "block" : "hidden md:block"}`}>
        {children}
      </section>
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
        active ? "border-indigo-300 bg-indigo-50 font-medium text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
      {count !== undefined && count > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{count}</span>}
    </button>
  );
}
