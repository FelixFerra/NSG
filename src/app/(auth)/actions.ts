"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password");
  if (!EMAIL_RE.test(email) || !password) return { error: "E-mail ou mot de passe invalide." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Message générique : ne pas révéler si le compte existe.
  if (error) return { error: "Identifiants incorrects ou e-mail non confirmé." };

  redirect("/dashboard");
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const fullName = readField(formData, "full_name").slice(0, 120);
  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password");

  if (!fullName) return { error: "Indique ton nom complet." };
  if (!EMAIL_RE.test(email)) return { error: "Adresse e-mail invalide." };
  if (password.length < 10) return { error: "Le mot de passe doit faire au moins 10 caractères." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });
  if (error) return { error: "Impossible de créer le compte. Réessaie plus tard." };

  // Confirmation d'e-mail activée dans Supabase : pas de session tout de suite.
  if (!data.session) return { message: "Compte créé : confirme ton e-mail pour te connecter." };

  redirect("/sources");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
