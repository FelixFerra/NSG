"use client";

import { useActionState } from "react";
import { Check, Send } from "lucide-react";
import type { Client, Context } from "@/lib/types";
import { requestExpertHelp, type ActionState } from "@/app/(app)/actions";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/** Poser une question libre à un expert : elle arrive dans sa boîte de réception. */
export function AskExpertForm({
  expertId,
  expertName,
  clients,
  contexts,
  defaultClientId,
}: {
  expertId: string;
  expertName: string;
  clients: Client[];
  contexts: Context[];
  defaultClientId?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestExpertHelp, {});

  if (state.ok) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <Check className="h-4 w-4" /> Question envoyée à {expertName}. Sa réponse arrivera dans ta boîte de réception.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="expert_id" value={expertId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <select name="client_id" defaultValue={defaultClientId ?? ""} className={input}>
          <option value="">Client : aucun</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
          ))}
        </select>
        <select name="context_id" defaultValue="" className={input}>
          <option value="">Sujet : aucun</option>
          {contexts.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <textarea name="message" required maxLength={2000} rows={3} placeholder={`Ta question pour ${expertName}…`} className={input} />
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        <Send className="h-4 w-4" /> {pending ? "Envoi…" : "Envoyer la question"}
      </button>
    </form>
  );
}
