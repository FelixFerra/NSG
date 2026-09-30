import "server-only";
import { cache } from "react";
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

// Les lectures sont mémorisées pour la durée d'une requête (cache() de React) :
// le layout et la page partagent le même client Supabase, donc les mêmes résultats.

const INFO_SELECT =
  "*, owner:employees(id, full_name, job_title, email), client:clients(id, name, country), context:contexts(id, label, slug)";

export const fetchInfos = cache(async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from("infos")
    .select(INFO_SELECT)
    .order("source_updated_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les infos.");
  return (data ?? []) as InfoWithRelations[];
});

export const fetchReferenceData = cache(async (supabase: SupabaseClient) => {
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
});

export type NotificationItem = Notification & {
  sender: Pick<Employee, "id" | "full_name"> | null;
  conflict: Pick<Conflict, "id" | "status"> | null;
};

/** Notifications de l'utilisateur connecté (RLS), à traiter d'abord. */
export const fetchNotifications = cache(async (supabase: SupabaseClient) => {
  const { data } = await supabase
    .from("notifications")
    .select("*, sender:employees!notifications_sender_id_fkey(id, full_name), conflict:conflicts(id, status)")
    .order("status", { ascending: false }) // 'open' avant 'done'
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as NotificationItem[];
});

export const fetchClientIssues = cache(async (supabase: SupabaseClient, clientId?: string) => {
  let query = supabase.from("client_issues").select("*").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data } = await query;
  return (data ?? []) as ClientIssue[];
});

export const fetchConflicts = cache(async (supabase: SupabaseClient) => {
  const { data } = await supabase.from("conflicts").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Conflict[];
});

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

/**
 * Un groupe = des conflits qui partagent des documents (composante connexe).
 * Ex. 4 versions du taux d'indexation d'un client = 1 groupe, pas 6 paires.
 * Les conflits en attente et les conflits tranchés sont groupés séparément.
 */
export type ConflictGroup = {
  key: string;
  conflicts: Conflict[];
  infoIds: string[];
  pending: boolean;
  contextId: string | null;
  createdAt: string;
  assigneeIds: string[];
};

export function buildConflictGroups(conflicts: Conflict[]): ConflictGroup[] {
  const groups: ConflictGroup[] = [];
  for (const pending of [true, false]) {
    const subset = conflicts.filter((c) => (c.status === "pending") === pending);
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x) ?? x;
      if (p === x) return x;
      const root = find(p);
      parent.set(x, root);
      return root;
    };
    for (const c of subset) {
      const a = find(c.original_info_id);
      const b = find(c.challenger_info_id);
      if (a !== b) parent.set(a, b);
    }
    const byRoot = new Map<string, Conflict[]>();
    for (const c of subset) {
      const root = find(c.original_info_id);
      byRoot.set(root, [...(byRoot.get(root) ?? []), c]);
    }
    for (const list of byRoot.values()) {
      const sorted = [...list].sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id));
      const infoIds = [...new Set(sorted.flatMap((c) => [c.original_info_id, c.challenger_info_id]))];
      groups.push({
        key: sorted[0].id,
        conflicts: sorted,
        infoIds,
        pending,
        contextId: sorted[0].context_id,
        createdAt: sorted[sorted.length - 1].created_at,
        assigneeIds: [...new Set(sorted.map((c) => c.assignee_id).filter((x): x is string => !!x))],
      });
    }
  }
  return groups.sort((a, b) => Number(b.pending) - Number(a.pending) || b.createdAt.localeCompare(a.createdAt));
}

/** conflictId -> groupe qui le contient. */
export function groupIndex(groups: ConflictGroup[]) {
  const map = new Map<string, ConflictGroup>();
  for (const g of groups) for (const c of g.conflicts) map.set(c.id, g);
  return map;
}

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
