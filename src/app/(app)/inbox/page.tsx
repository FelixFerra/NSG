import Link from "next/link";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchNotifications } from "@/lib/data";
import { EmptyState, PageHeader } from "@/components/ui";
import { NotificationRow } from "@/components/notification-row";

export default async function InboxPage(props: PageProps<"/inbox">) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab === "history" ? "history" : "todo";

  const { supabase } = await getCurrentEmployee();
  const all = await fetchNotifications(supabase);
  const todo = all.filter((n) => n.status === "open");
  const history = all.filter((n) => n.status === "done");
  const items = tab === "todo" ? todo : history;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Boîte de réception"
        subtitle="Demandes de validation, questions transférées par tes collègues et réponses reçues."
      />

      {searchParams.done === "1" && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Réponse envoyée : ton collègue a été notifié.
        </p>
      )}

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <Tab href="/inbox" active={tab === "todo"} label={`À traiter (${todo.length})`} />
        <Tab href="/inbox?tab=history" active={tab === "history"} label={`Traité (${history.length})`} />
      </div>

      {items.length === 0 ? (
        <EmptyState>{tab === "todo" ? "Rien à traiter. Bravo !" : "Aucun élément traité pour l'instant."}</EmptyState>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((n) => (
            <li key={n.id} className="border-b border-slate-100 last:border-0">
              <NotificationRow item={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`flex-1 rounded-md px-3 py-1.5 text-center ${active ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
    >
      {label}
    </Link>
  );
}
