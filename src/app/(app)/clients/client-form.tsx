"use client";

import { useActionState } from "react";
import type { Client, Employee } from "@/lib/types";
import { createClientAccount, updateClientProfile, type FormState } from "./actions";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/** Création (sans `client`) ou édition du profil d'un client. */
export function ClientForm({ client, employees }: { client?: Client; employees: Pick<Employee, "id" | "full_name">[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    client ? updateClientProfile : createClientAccount,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {client && <input type="hidden" name="client_id" value={client.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du client *">
          <input name="name" required maxLength={200} defaultValue={client?.name} className={input} />
        </Field>
        <Field label="Pays * (code à 2 lettres)">
          <input name="country" required maxLength={2} defaultValue={client?.country ?? ""} placeholder="BE" className={`${input} uppercase`} />
        </Field>
        <Field label="Secteur / commission paritaire">
          <input name="sector" maxLength={200} defaultValue={client?.sector ?? ""} placeholder="Horeca (CP 302)" className={input} />
        </Field>
        <Field label="Effectif">
          <input name="headcount" inputMode="numeric" pattern="\d*" defaultValue={client?.headcount ?? ""} className={input} />
        </Field>
        <Field label="Contact chez le client">
          <input name="contact_name" maxLength={200} defaultValue={client?.contact_name ?? ""} className={input} />
        </Field>
        <Field label="E-mail du contact">
          <input name="contact_email" type="email" maxLength={200} defaultValue={client?.contact_email ?? ""} className={input} />
        </Field>
        <Field label="Responsable du compte">
          <select name="account_owner_id" defaultValue={client?.account_owner_id ?? ""} className={input}>
            <option value="">Aucun</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Description, particularités (accords, conventions…)">
        <textarea name="description" maxLength={4000} rows={3} defaultValue={client?.description ?? ""} className={input} />
      </Field>

      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Profil mis à jour.</p>}

      <button disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Enregistrement…" : client ? "Enregistrer le profil" : "Créer le client"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
