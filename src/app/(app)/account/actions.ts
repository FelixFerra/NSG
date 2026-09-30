"use server";

import { revalidatePath } from "next/cache";
import { getCurrentEmployee } from "@/lib/supabase/server";

export type ProfileState = { ok?: boolean; error?: string };

function text(formData: FormData, name: string, max: number) {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export async function updateMyProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const fullName = text(formData, "full_name", 120);
  const country = text(formData, "country", 2).toUpperCase();
  if (!fullName) return { error: "Le nom est obligatoire." };
  if (country && !/^[A-Z]{2}$/.test(country)) return { error: "Pays : code à 2 lettres (BE, FR…)." };

  const { supabase, employee } = await getCurrentEmployee();
  if (!employee) return { error: "Session expirée." };

  // RLS + droits par colonne : seule sa propre ligne, seuls ces champs
  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      job_title: text(formData, "job_title", 120) || null,
      department: text(formData, "department", 120) || null,
      country: country || null,
    })
    .eq("id", employee.id);
  if (error) return { error: "Mise à jour impossible." };

  revalidatePath("/", "layout");
  return { ok: true };
}
