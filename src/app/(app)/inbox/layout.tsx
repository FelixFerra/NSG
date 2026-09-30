import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchNotifications, fetchReferenceData } from "@/lib/data";
import { InboxShell } from "./inbox-shell";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await getCurrentEmployee();
  const [items, { clients, contexts }] = await Promise.all([
    fetchNotifications(supabase),
    fetchReferenceData(supabase),
  ]);

  return (
    <InboxShell
      items={items}
      clientNames={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
      contextLabels={Object.fromEntries(contexts.map((c) => [c.id, c.label]))}
    >
      {children}
    </InboxShell>
  );
}
