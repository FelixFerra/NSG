import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Context, Employee, InfoWithRelations } from "./types";

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
  const [clients, contexts, employees] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("contexts").select("*").order("label"),
    supabase.from("employees").select("*").order("full_name"),
  ]);
  return {
    clients: (clients.data ?? []) as Client[],
    contexts: (contexts.data ?? []) as Context[],
    employees: (employees.data ?? []) as Employee[],
  };
}

/** Expert à contacter : propriétaire de l'info, sinon un expert du sujet dans le bon pays. */
export function findExpert(
  info: InfoWithRelations,
  employees: Employee[],
  country?: string | null,
): Employee | null {
  if (info.owner) return employees.find((e) => e.id === info.owner?.id) ?? null;
  const slug = info.context?.slug;
  if (!slug) return null;
  const candidates = employees.filter((e) => e.expertise.includes(slug));
  return (
    candidates.find((e) => e.country === (country ?? info.country)) ?? candidates[0] ?? null
  );
}
