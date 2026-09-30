import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
import type { Employee } from "@/lib/types";

/** Un client Supabase par requête (partagé entre le layout et la page). */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseEnv();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
});

/**
 * Utilisateur connecté + sa fiche employé, une seule fois par requête.
 * getClaims() vérifie la signature du JWT localement (clés asymétriques) :
 * pas d'aller-retour vers Supabase Auth à chaque page.
 */
export const getCurrentEmployee = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null, employee: null };

  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { supabase, user, employee: employee as Employee | null };
});
