"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

export type ActionState = { ok?: boolean; error?: string };

/** Transfère le contexte d'une impasse documentaire à un expert (notification in-app). */
export async function requestExpertHelp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const expertId = uuidField(formData, "expert_id");
  const raw = formData.get("message");
  const message = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";
  if (!expertId || !message) return { error: "Demande invalide." };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  const { error } = await supabase.rpc("request_expert_help", {
    p_expert_id: expertId,
    p_message: message,
    p_client_id: uuidField(formData, "client_id"),
    p_context_id: uuidField(formData, "context_id"),
  });
  if (error) return { error: error.code === "54000" ? "Trop de demandes, réessaie dans une minute." : "Envoi impossible." };
  return { ok: true };
}

/** Valider (accept) ou rejeter (reject) l'info qui conteste l'original. */
export async function resolveConflict(formData: FormData) {
  const conflictId = uuidField(formData, "conflict_id");
  const decision = formData.get("decision");
  if (!conflictId || (decision !== "accept" && decision !== "reject")) return;

  const { supabase } = await getCurrentEmployee();
  // L'autorisation est vérifiée en base (resolve_conflict).
  await supabase.rpc("resolve_conflict", { p_conflict_id: conflictId, p_decision: decision });

  revalidatePath("/", "layout");
}

export async function markNotificationRead(formData: FormData) {
  const id = uuidField(formData, "notification_id");
  if (!id) return;
  const { supabase } = await getCurrentEmployee();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/", "layout");
}
