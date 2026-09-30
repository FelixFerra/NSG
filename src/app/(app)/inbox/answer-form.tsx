"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import type { Context } from "@/lib/types";
import { answerHandoff, type ActionState } from "../actions";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function AnswerForm(props: {
  notificationId: string;
  clientId: string | null;
  contextId: string | null;
  country: string | null;
  contexts: Context[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(answerHandoff, {});
  const [save, setSave] = useState(true);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="notification_id" value={props.notificationId} />
      {props.clientId && <input type="hidden" name="client_id" value={props.clientId} />}
      {props.country && <input type="hidden" name="country" value={props.country} />}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Ta réponse</span>
        <textarea name="answer" required maxLength={2000} rows={4} className={input} placeholder="Réponse précise, avec les chiffres et la source si possible." />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="save_as_info" checked={save} onChange={(e) => setSave(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Ajouter aussi cette réponse à la base de savoir (pour que la prochaine personne la trouve)
      </label>

      {save && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="info_title" required maxLength={200} placeholder="Titre de l'info" className={input} />
          <select name="context_id" required defaultValue={props.contextId ?? ""} className={input}>
            <option value="" disabled>Sujet…</option>
            {props.contexts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <button disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        <Send className="h-4 w-4" /> {pending ? "Envoi…" : "Envoyer la réponse"}
      </button>
    </form>
  );
}
