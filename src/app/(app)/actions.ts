"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

function textField(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export type ActionState = { ok?: boolean; error?: string };

/** Transfère le contexte d'une impasse (recherche vide ou conflit) à un expert. */
export async function requestExpertHelp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const expertId = uuidField(formData, "expert_id");
  const message = textField(formData, "message", 2000);
  if (!expertId || !message) return { error: "Écris un message." };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  const { error } = await supabase.rpc("request_expert_help", {
    p_expert_id: expertId,
    p_message: message,
    p_client_id: uuidField(formData, "client_id"),
    p_context_id: uuidField(formData, "context_id"),
    p_conflict_id: uuidField(formData, "conflict_id"),
  });
  if (error) return { error: error.code === "54000" ? "Trop de demandes, réessaie dans une minute." : "Envoi impossible." };
  return { ok: true };
}

/** Répondre à une demande d'aide ; option : ajouter la réponse à la base de savoir. */
export async function answerHandoff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const notificationId = uuidField(formData, "notification_id");
  const answer = textField(formData, "answer", 2000);
  if (!notificationId || !answer) return { error: "Écris une réponse." };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  if (formData.get("save_as_info") === "on") {
    const title = textField(formData, "info_title", 200);
    const contextId = uuidField(formData, "context_id");
    if (!title || !contextId) return { error: "Pour l'ajouter à la base, il faut un titre et un sujet." };
    const { error } = await supabase.from("infos").insert({
      title,
      content: answer,
      source_type: "manual",
      source_label: "Réponse d'expert",
      context_id: contextId,
      client_id: uuidField(formData, "client_id"),
      country: textField(formData, "country", 2).toUpperCase() || null,
      employee_id: employee.id,
      status: "active",
    });
    if (error) return { error: "Impossible d'ajouter l'info à la base." };
  }

  const { error } = await supabase.rpc("answer_handoff", { p_notification_id: notificationId, p_answer: answer });
  if (error) return { error: "Envoi de la réponse impossible." };

  revalidatePath("/", "layout");
  redirect("/inbox?done=1");
}

/** Trancher un groupe de conflits en choisissant la bonne version. */
export async function resolveConflictGroup(formData: FormData) {
  const conflictId = uuidField(formData, "conflict_id");
  const winnerId = uuidField(formData, "winner_info_id");
  if (!conflictId || !winnerId) return;

  const { supabase } = await getCurrentEmployee();
  await supabase.rpc("resolve_conflict_group", { p_conflict_id: conflictId, p_winner_info_id: winnerId });

  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return;
  // RLS : ne touche que les notifications de l'utilisateur
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", employee.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}

export async function markNotificationDone(formData: FormData) {
  const id = uuidField(formData, "notification_id");
  if (!id) return;
  const { supabase } = await getCurrentEmployee();
  await supabase
    .from("notifications")
    .update({ status: "done", read_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/", "layout");
}
