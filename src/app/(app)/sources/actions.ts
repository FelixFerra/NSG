"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { isConnectorId } from "@/lib/connectors";

/**
 * Connexion SIMULÉE : aucun OAuth n'est lancé, on enregistre juste l'état en base.
 * TODO : remplacer par le flux OAuth du fournisseur (Microsoft Graph, Google, Slack…).
 */
export async function connectSource(formData: FormData) {
  const provider = formData.get("provider");
  if (!isConnectorId(provider)) return;

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return;

  const now = new Date().toISOString();
  await supabase.from("data_sources").upsert(
    {
      employee_id: employee.id,
      provider,
      status: "connected",
      connected_at: now,
      last_synced_at: now,
    },
    { onConflict: "employee_id,provider" },
  );

  revalidatePath("/sources");
}

export async function disconnectSource(formData: FormData) {
  const provider = formData.get("provider");
  if (!isConnectorId(provider)) return;

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return;

  await supabase
    .from("data_sources")
    .update({ status: "disconnected", connected_at: null })
    .eq("employee_id", employee.id)
    .eq("provider", provider);

  revalidatePath("/sources");
}

export async function syncSource(formData: FormData) {
  const provider = formData.get("provider");
  if (!isConnectorId(provider)) return;

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return;

  await supabase
    .from("data_sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("employee_id", employee.id)
    .eq("provider", provider)
    .eq("status", "connected");

  revalidatePath("/sources");
}
