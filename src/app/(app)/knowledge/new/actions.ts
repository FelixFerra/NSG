"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { isSourceType } from "@/lib/connectors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewInfoState = { error?: string };

function text(formData: FormData, name: string, max: number) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function createInfo(_prev: NewInfoState, formData: FormData): Promise<NewInfoState> {
  const title = text(formData, "title", 200);
  const content = text(formData, "content", 4000);
  const contextId = text(formData, "context_id", 36);
  const clientId = text(formData, "client_id", 36);
  const country = text(formData, "country", 2).toUpperCase();
  const sourceType = text(formData, "source_type", 20);
  const sourceLabel = text(formData, "source_label", 200);
  const sourceUrl = text(formData, "source_url", 500);
  const validUntil = text(formData, "valid_until", 10);

  if (!title || !content) return { error: "Titre et contenu sont obligatoires." };
  if (!UUID_RE.test(contextId)) return { error: "Choisis un sujet." };
  if (clientId && !UUID_RE.test(clientId)) return { error: "Client invalide." };
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: "Pays : code à 2 lettres (BE, FR…)." };
  if (!isSourceType(sourceType)) return { error: "Source invalide." };
  if (sourceUrl && !/^https:\/\/[^\s]+$/.test(sourceUrl)) return { error: "Le lien doit commencer par https://" };
  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return { error: "Date de validité invalide." };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  // Dates, statut officiel et signature sont imposés côté base (trigger before_info_insert).
  const { data, error } = await supabase
    .from("infos")
    .insert({
      title,
      content,
      context_id: contextId,
      client_id: clientId || null,
      country: country || null,
      source_type: sourceType,
      source_label: sourceLabel || null,
      source_url: sourceUrl || null,
      valid_until: validUntil || null,
      employee_id: employee.id,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.code === "54000" ? "Trop d'ajouts, réessaie plus tard." : "Enregistrement impossible." };
  }

  // Le trigger a déjà détecté les conflits et notifié les auteurs concernés.
  const { count } = await supabase
    .from("conflicts")
    .select("id", { count: "exact", head: true })
    .or(`original_info_id.eq.${data.id},challenger_info_id.eq.${data.id}`);

  revalidatePath("/", "layout");
  redirect(`/knowledge?added=1&conflicts=${count ?? 0}`);
}
