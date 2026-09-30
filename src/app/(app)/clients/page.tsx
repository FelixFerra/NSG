import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchClientIssues, fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export default async function ClientsPage() {
  const { supabase } = await getCurrentEmployee();
  const [infos, issues, { clients, employees }] = await Promise.all([
    fetchInfos(supabase),
    fetchClientIssues(supabase),
    fetchReferenceData(supabase),
  ]);

  return (
    <>
      <PageHeader title="Clients" subtitle={`${clients.length} client(s) : profil, problèmes en cours et documents de chacun.`}>
        <Link href="/clients/new" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Nouveau client
        </Link>
      </PageHeader>

      {clients.length === 0 ? (
        <EmptyState>Aucun client. Crée le premier avec « Nouveau client ».</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Pays</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Secteur</th>
                <th className="hidden px-4 py-2.5 lg:table-cell">Responsable</th>
                <th className="hidden px-4 py-2.5 text-right sm:table-cell">Documents</th>
                <th className="px-4 py-2.5 text-right">Problèmes</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((client) => {
                const owner = employees.find((e) => e.id === client.account_owner_id);
                const docs = infos.filter((i) => i.client_id === client.id).length;
                const open = issues.filter((i) => i.client_id === client.id && i.status === "open").length;
                return (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/clients/${client.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{client.country ?? "—"}</td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{client.sector ?? "—"}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {owner ? (
                        <Link href={`/team/${owner.id}`} className="text-slate-700 hover:text-indigo-700 hover:underline">{owner.full_name}</Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-slate-600 sm:table-cell">{docs}</td>
                    <td className="px-4 py-3 text-right">{open ? <Badge tone="warn">{open} en cours</Badge> : <span className="text-slate-400">0</span>}</td>
                    <td className="pr-3">
                      <Link href={`/clients/${client.id}`} aria-label={`Ouvrir ${client.name}`} className="text-slate-400 hover:text-slate-700">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
