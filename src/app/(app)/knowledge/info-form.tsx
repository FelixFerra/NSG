"use client";

import { useActionState } from "react";
import type { Client, Context, Info } from "@/lib/types";
import { CONNECTORS } from "@/lib/connectors";
import { createInfo, updateInfo, type InfoFormState } from "./actions";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/** Ajout (sans `info`) ou modification d'une de ses infos. */
export function InfoForm({ clients, contexts, info }: { clients: Client[]; contexts: Context[]; info?: Info }) {
  const [state, action, pending] = useActionState<InfoFormState, FormData>(info ? updateInfo : createInfo, {});

  return (
    <form action={action} className="space-y-4">
      {info && <input type="hidden" name="info_id" value={info.id} />}
      <Field label="Titre *">
        <input name="title" required maxLength={200} defaultValue={info?.title} className={input} placeholder="Ex. Indexation CP 302 — janvier 2026" />
      </Field>
      <Field label="Contenu *" hint="Indique les chiffres clés (taux, jours, montants) : ils servent à détecter les contradictions.">
        <textarea name="content" required maxLength={4000} rows={4} defaultValue={info?.content} className={input} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sujet *">
          <select name="context_id" required defaultValue={info?.context_id ?? ""} className={input}>
            <option value="" disabled>Choisir…</option>
            {contexts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Client (si spécifique)">
          <select name="client_id" defaultValue={info?.client_id ?? ""} className={input}>
            <option value="">Aucun : info générale</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.country})</option>)}
          </select>
        </Field>
        <Field label="Pays">
          <input name="country" maxLength={2} defaultValue={info?.country ?? ""} placeholder="BE" className={`${input} uppercase`} />
        </Field>
        <Field label="Valable jusqu'au">
          <input name="valid_until" type="date" defaultValue={info?.valid_until ?? ""} className={input} />
        </Field>
        <Field label="Source *">
          <select name="source_type" required defaultValue={info?.source_type ?? "manual"} className={input}>
            <option value="manual">Saisie manuelle</option>
            {CONNECTORS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Référence de la source">
          <input name="source_label" maxLength={200} defaultValue={info?.source_label ?? ""} placeholder="Canal, dossier, objet du mail…" className={input} />
        </Field>
      </div>
      <Field label="Lien (https)">
        <input name="source_url" type="url" maxLength={500} defaultValue={info?.source_url ?? ""} placeholder="https://…" className={input} />
      </Field>

      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Les statuts « document officiel » et « signé » ne peuvent pas être auto-déclarés : ils viennent de la source
        d&apos;origine lors de l&apos;import.
        {info && " Si tu modifies le contenu, les contradictions sont réévaluées."}
      </p>

      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <button disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Enregistrement…" : info ? "Enregistrer les modifications" : "Ajouter et vérifier les contradictions"}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
