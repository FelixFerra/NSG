"use client";

import { useActionState } from "react";
import type { Employee } from "@/lib/types";
import { updateMyProfile, type ProfileState } from "./actions";

const input =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function ProfileForm({ employee }: { employee: Employee }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateMyProfile, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *">
          <input name="full_name" required maxLength={120} defaultValue={employee.full_name} className={input} />
        </Field>
        <Field label="E-mail">
          <input value={employee.email} disabled className={`${input} bg-slate-50 text-slate-500`} />
        </Field>
        <Field label="Poste">
          <input name="job_title" maxLength={120} defaultValue={employee.job_title ?? ""} placeholder="Payroll consultant" className={input} />
        </Field>
        <Field label="Service">
          <input name="department" maxLength={120} defaultValue={employee.department ?? ""} placeholder="Payroll Services" className={input} />
        </Field>
        <Field label="Pays (code à 2 lettres)">
          <input name="country" maxLength={2} defaultValue={employee.country ?? ""} placeholder="BE" className={`${input} uppercase`} />
        </Field>
      </div>

      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Profil mis à jour.</p>}

      <button disabled={pending} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
        {pending ? "Enregistrement…" : "Enregistrer"}
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
