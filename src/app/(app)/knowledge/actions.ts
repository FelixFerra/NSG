"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { isSourceType } from "@/lib/connectors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type InfoFormState = { error?: string };

function text(formData: FormData, name: string, max: number) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Champs éditables d'une info, validés. */
function readInfo(formData: FormData) {
  const title = text(formData, "title", 200);
  const content = text(formData, "content", 4000);
  const contextId = text(formData, "context_id", 36);
  const clientId = text(formData, "client_id", 36);
  const country = text(formData, "country", 2).toUpperCase();
  const sourceType = text(formData, "source_type", 20);
  const sourceLabel = text(formData, "source_label", 200);
  const sourceUrl = text(formData, "source_url", 500);
  const validUntil = text(formData, "valid_until", 10);

  if (!title || !content) return { error: "Titre et contenu sont obligatoires." } as const;
  if (!UUID_RE.test(contextId)) return { error: "Choisis un sujet." } as const;
  if (clientId && !UUID_RE.test(clientId)) return { error: "Client invalide." } as const;
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: "Pays : code à 2 lettres (BE, FR…)." } as const;
  if (!isSourceType(sourceType)) return { error: "Source invalide." } as const;
  if (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl)) return { error: "Le lien doit commencer par https://" } as const;
  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return { error: "Date de validité invalide." } as const;

  return {
    fields: {
      title,
      content,
      context_id: contextId,
      client_id: clientId || null,
      country: country || null,
      source_type: sourceType,
      source_label: sourceLabel || null,
      source_url: sourceUrl || null,
      valid_until: validUntil || null,
    },
  } as const;
}

async function countConflicts(supabase: Awaited<ReturnType<typeof getCurrentEmployee>>["supabase"], infoId: string) {
  const { count } = await supabase
    .from("conflicts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .or(`original_info_id.eq.${infoId},challenger_info_id.eq.${infoId}`);
  return count ?? 0;
}

export async function createInfo(_prev: InfoFormState, formData: FormData): Promise<InfoFormState> {
  const parsed = readInfo(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  // Dates, statut officiel et signature sont imposés côté base (trigger before_info_insert).
  const { data, error } = await supabase
    .from("infos")
    .insert({ ...parsed.fields, employee_id: employee.id, status: "active" })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.code === "54000" ? "Trop d'ajouts, réessaie plus tard." : "Enregistrement impossible." };
  }

  // Le trigger a déjà détecté les conflits et notifié les auteurs concernés.
  const conflicts = await countConflicts(supabase, data.id);
  revalidatePath("/", "layout");
  redirect(`/knowledge?added=1&conflicts=${conflicts}`);
}

/** Modifier une de SES infos (RLS + droits par colonne côté base). */
export async function updateInfo(_prev: InfoFormState, formData: FormData): Promise<InfoFormState> {
  const infoId = text(formData, "info_id", 36);
  if (!UUID_RE.test(infoId)) return { error: "Info invalide." };
  const parsed = readInfo(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  const { data, error } = await supabase
    .from("infos")
    .update(parsed.fields)
    .eq("id", infoId)
    .eq("employee_id", employee.id)
    .select("id");
  if (error || !data?.length) return { error: "Modification impossible : tu ne peux modifier que tes propres infos." };

  // Si le contenu a changé, les conflits ont été réévalués par le trigger.
  const conflicts = await countConflicts(supabase, infoId);
  revalidatePath("/", "layout");
  redirect(`/knowledge?updated=1&conflicts=${conflicts}`);
}

export async function deleteInfo(formData: FormData) {
  const infoId = text(formData, "info_id", 36);
  if (!UUID_RE.test(infoId)) return;

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return;

  // RLS : seules ses propres infos ; conflits et notifications liés sont supprimés en cascade.
  await supabase.from("infos").delete().eq("id", infoId).eq("employee_id", employee.id);

  revalidatePath("/", "layout");
  redirect("/knowledge?deleted=1");
}
