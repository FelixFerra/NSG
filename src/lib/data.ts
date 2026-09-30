import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Client,
  ClientIssue,
  Conflict,
  Context,
  Employee,
  ExpertiseScore,
  InfoWithRelations,
  Notification,
} from "./types";

const INFO_SELECT =
  "*, owner:employees(id, full_name, job_title, email), client:clients(id, name, country), context:contexts(id, label, slug)";

export async function fetchInfos(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("infos")
    .select(INFO_SELECT)
    .order("source_updated_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les infos.");
  return (data ?? []) as InfoWithRelations[];
}

export async function fetchReferenceData(supabase: SupabaseClient) {
  const [clients, contexts, employees, expertise] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("contexts").select("*").order("label"),
    supabase.from("employees").select("*").order("full_name"),
    supabase.from("expertise_scores").select("employee_id, context_id, score"),
  ]);
  return {
    clients: (clients.data ?? []) as Client[],
    contexts: (contexts.data ?? []) as Context[],
    employees: (employees.data ?? []) as Employee[],
    expertise: (expertise.data ?? []) as ExpertiseScore[],
  };
}

export type NotificationItem = Notification & {
  sender: Pick<Employee, "id" | "full_name"> | null;
  conflict: Pick<Conflict, "id" | "status"> | null;
};

/** Notifications de l'utilisateur connecté (RLS), non lues et à traiter d'abord. */
export async function fetchNotifications(supabase: SupabaseClient, options: { limit?: number } = {}) {
  const { data } = await supabase
    .from("notifications")
    .select("*, sender:employees!notifications_sender_id_fkey(id, full_name), conflict:conflicts(id, status)")
    .order("status", { ascending: false }) // 'open' avant 'done'
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);
  return (data ?? []) as NotificationItem[];
}

export async function fetchClientIssues(supabase: SupabaseClient, clientId?: string) {
  let query = supabase.from("client_issues").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data } = await query;
  return (data ?? []) as ClientIssue[];
}

export async function fetchConflicts(supabase: SupabaseClient) {
  const { data } = await supabase.from("conflicts").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Conflict[];
}

/** infoId -> infos qui la contredisent (conflits en attente uniquement). */
export function buildConflictIndex(conflicts: Conflict[], infos: InfoWithRelations[]) {
  const byId = new Map(infos.map((i) => [i.id, i]));
  const index = new Map<string, { conflict: Conflict; other: InfoWithRelations }[]>();
  for (const conflict of conflicts) {
    if (conflict.status !== "pending") continue;
    const a = byId.get(conflict.original_info_id);
    const b = byId.get(conflict.challenger_info_id);
    if (!a || !b) continue;
    index.set(a.id, [...(index.get(a.id) ?? []), { conflict, other: b }]);
    index.set(b.id, [...(index.get(b.id) ?? []), { conflict, other: a }]);
  }
  return index;
}

export type ConflictIndex = ReturnType<typeof buildConflictIndex>;

export type RankedExpert = { employee: Employee; score: number; authority: Authority };

export type Authority = { label: string; tone: "good" | "info" | "neutral" };

export function authorityOf(score: number): Authority {
  if (score >= 10) return { label: "Référent", tone: "good" };
  if (score >= 5) return { label: "Confirmé", tone: "info" };
  if (score >= 1) return { label: "Contributeur", tone: "neutral" };
  return { label: "Aucune expertise mesurée", tone: "neutral" };
}

/** Experts classés par score sur un domaine (ou score total si pas de domaine). */
export function rankExperts(
  expertise: ExpertiseScore[],
  employees: Employee[],
  options: { contextId?: string | null; country?: string | null; excludeId?: string | null; limit?: number } = {},
): RankedExpert[] {
  const totals = new Map<string, number>();
  for (const row of expertise) {
    if (options.contextId && row.context_id !== options.contextId) continue;
    totals.set(row.employee_id, (totals.get(row.employee_id) ?? 0) + row.score);
  }
  return employees
    .filter((e) => e.id !== options.excludeId && (totals.get(e.id) ?? 0) > 0)
    .map((employee) => {
      const score = totals.get(employee.id) ?? 0;
      return { employee, score, authority: authorityOf(score) };
    })
    // Même score : priorité aux experts du pays concerné
    .sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.employee.country === options.country) - Number(a.employee.country === options.country),
    )
    .slice(0, options.limit ?? 3);
}
