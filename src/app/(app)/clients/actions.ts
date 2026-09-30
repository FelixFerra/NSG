"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormState = { error?: string; ok?: boolean };

function text(formData: FormData, name: string, max: number) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function uuid(formData: FormData, name: string) {
  const v = text(formData, name, 36);
  return UUID_RE.test(v) ? v : null;
}

/** Champs du profil client, validés. */
function readProfile(formData: FormData) {
  const name = text(formData, "name", 200);
  const country = text(formData, "country", 2).toUpperCase();
  const headcountRaw = text(formData, "headcount", 7);
  const contactEmail = text(formData, "contact_email", 200);

  if (!name) return { error: "Le nom du client est obligatoire." } as const;
  if (!/^[A-Z]{2}$/.test(country)) return { error: "Pays : code à 2 lettres (BE, FR, DE…)." } as const;
  if (headcountRaw && !/^\d+$/.test(headcountRaw)) return { error: "Effectif : nombre entier." } as const;
  if (contactEmail && !EMAIL_RE.test(contactEmail)) return { error: "E-mail du contact invalide." } as const;

  return {
    profile: {
      name,
      country,
      sector: text(formData, "sector", 200) || null,
      headcount: headcountRaw ? Number(headcountRaw) : null,
      contact_name: text(formData, "contact_name", 200) || null,
      contact_email: contactEmail || null,
      account_owner_id: uuid(formData, "account_owner_id"),
      description: text(formData, "description", 4000) || null,
    },
  } as const;
}

export async function createClientAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = readProfile(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.profile, created_by: employee.id })
    .select("id")
    .single();
  if (error || !data) return { error: "Création impossible." };

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const clientId = uuid(formData, "client_id");
  if (!clientId) return { error: "Client invalide." };
  const parsed = readProfile(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { supabase } = await getCurrentEmployee();
  const { error } = await supabase.from("clients").update(parsed.profile).eq("id", clientId);
  if (error) return { error: "Mise à jour impossible." };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function addClientIssue(_prev: FormState, formData: FormData): Promise<FormState> {
  const clientId = uuid(formData, "client_id");
  const title = text(formData, "title", 200);
  if (!clientId || !title) return { error: "Décris le problème en une phrase." };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  const { error } = await supabase.from("client_issues").insert({
    client_id: clientId,
    title,
    description: text(formData, "description", 4000) || null,
    context_id: uuid(formData, "context_id"),
    created_by: employee.id,
  });
  if (error) return { error: "Ajout impossible." };

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function setClientIssueStatus(formData: FormData) {
  const issueId = uuid(formData, "issue_id");
  const clientId = uuid(formData, "client_id");
  const status = formData.get("status");
  if (!issueId || !clientId || (status !== "open" && status !== "resolved")) return;

  const { supabase } = await getCurrentEmployee();
  await supabase
    .from("client_issues")
    .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null })
    .eq("id", issueId);

  revalidatePath(`/clients/${clientId}`);
}
