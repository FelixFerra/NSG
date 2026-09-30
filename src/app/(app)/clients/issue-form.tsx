"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { Context } from "@/lib/types";
import { addClientIssue, type FormState } from "./actions";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function IssueForm({ clientId, contexts }: { clientId: string; contexts: Context[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addClientIssue, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <input name="title" required maxLength={200} placeholder="Nouveau problème en cours…" className={input} />
        <select name="context_id" defaultValue="" className={input}>
          <option value="">Sujet</option>
          {contexts.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <textarea name="description" maxLength={4000} rows={2} placeholder="Détails (facultatif)" className={input} />
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        <Plus className="h-4 w-4" /> {pending ? "Ajout…" : "Ajouter le problème"}
      </button>
    </form>
  );
}
