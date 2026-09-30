import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchClientIssues, fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function ClientsPage() {
  const { supabase } = await getCurrentEmployee();
  const [infos, issues, { clients, employees }] = await Promise.all([
    fetchInfos(supabase),
    fetchClientIssues(supabase),
    fetchReferenceData(supabase),
  ]);

  return (
    <>
      <PageHeader title="Clients" subtitle="Chaque fiche regroupe le profil du client, ses problèmes en cours et ses documents.">
        <Link href="/clients/new" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Nouveau client
        </Link>
      </PageHeader>
      {clients.length === 0 ? (
        <EmptyState>Aucun client. Crée le premier avec « Nouveau client ».</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const owner = employees.find((e) => e.id === client.account_owner_id);
            const docs = infos.filter((i) => i.client_id === client.id).length;
            const open = issues.filter((i) => i.client_id === client.id && i.status === "open").length;
            return (
              <Link key={client.id} href={`/clients/${client.id}`} className="block">
                <Card className="h-full transition hover:border-indigo-300">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium">{client.name}</h2>
                    {client.country && <Badge>{client.country}</Badge>}
                  </div>
                  <p className="text-sm text-slate-500">{client.sector ?? "—"}</p>
                  <dl className="mt-4 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Responsable</dt>
                      <dd>{owner?.full_name ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Documents</dt>
                      <dd>{docs}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Problèmes en cours</dt>
                      <dd>{open ? <Badge tone="warn">{open}</Badge> : 0}</dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
