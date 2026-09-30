import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictGroups, fetchConflicts, fetchNotifications, fetchReferenceData, groupIndex } from "@/lib/data";
import { InboxShell } from "./inbox-shell";

export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const { supabase } = await getCurrentEmployee();
  const [items, conflicts, { clients, contexts }] = await Promise.all([
    fetchNotifications(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);
  const groups = groupIndex(buildConflictGroups(conflicts));

  return (
    <InboxShell
      items={items}
      clientNames={Object.fromEntries(clients.map((c) => [c.id, c.name]))}
      contextLabels={Object.fromEntries(contexts.map((c) => [c.id, c.label]))}
      groupKeys={Object.fromEntries([...groups.entries()].map(([conflictId, g]) => [conflictId, g.key]))}
    >
      {children}
    </InboxShell>
  );
}
