import Link from "next/link";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData } from "@/lib/data";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function ClientsPage() {
  const { supabase } = await getCurrentEmployee();
  const [infos, { clients, employees }] = await Promise.all([
    fetchInfos(supabase),
    fetchReferenceData(supabase),
  ]);

  return (
    <>
      <PageHeader title="Clients" subtitle="Le savoir spécifique à chaque client, et qui le suit." />
      {clients.length === 0 ? (
        <EmptyState>Aucun client. Exécute supabase/seed.sql pour charger les données de démo.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const owner = employees.find((e) => e.id === client.account_owner_id);
            const specific = infos.filter((i) => i.client_id === client.id).length;
            return (
              <Card key={client.id}>
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
                    <dt className="text-slate-500">Infos spécifiques</dt>
                    <dd>{specific}</dd>
                  </div>
                </dl>
                <Link href={`/knowledge?client=${client.id}`} className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
                  Voir le savoir applicable →
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
