import { CheckCircle2, RefreshCw, Info as InfoIcon } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { CONNECTORS } from "@/lib/connectors";
import type { DataSource } from "@/lib/types";
import { Badge, Card, PageHeader, formatDateTime } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConnectorLogo } from "@/components/connector-logo";
import { connectSource, disconnectSource, syncSource } from "./actions";

export default async function SourcesPage() {
  const { supabase, employee } = await getCurrentEmployee();

  const { data } = employee
    ? await supabase.from("data_sources").select("*").eq("employee_id", employee.id)
    : { data: [] };
  const sources = new Map((data as DataSource[] | null ?? []).map((s) => [s.provider, s]));
  const connectedCount = [...sources.values()].filter((s) => s.status === "connected").length;

  return (
    <>
      <PageHeader
        title="Sources connectées"
        subtitle="Connecte tes outils pour que leur savoir soit indexé, daté et attribué à un propriétaire."
      >
        <Badge tone={connectedCount ? "good" : "neutral"}>
          {connectedCount} / {CONNECTORS.length} connectées
        </Badge>
      </PageHeader>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Prototype : la connexion est <strong>simulée</strong>. Aucun accès réel à tes comptes n&apos;est
          demandé ; seul l&apos;état de la connexion est enregistré.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CONNECTORS.map((connector) => {
          const source = sources.get(connector.id);
          const connected = source?.status === "connected";
          return (
            <Card key={connector.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <ConnectorLogo id={connector.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-medium">{connector.name}</h2>
                    {connected ? (
                      <Badge tone="good">
                        <CheckCircle2 className="h-3 w-3" /> Connecté
                      </Badge>
                    ) : (
                      <Badge>Non connecté</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {connector.vendor} · {connector.kind}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-600">{connector.description}</p>

              {connected && (
                <p className="mt-3 text-xs text-slate-500">
                  Dernière synchro : {formatDateTime(source?.last_synced_at ?? null)}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                <form action={connected ? disconnectSource : connectSource} className="flex-1">
                  <input type="hidden" name="provider" value={connector.id} />
                  <SubmitButton variant={connected ? "secondary" : "primary"} className="w-full">
                    {connected ? "Déconnecter" : "Connecter"}
                  </SubmitButton>
                </form>
                {connected && (
                  <form action={syncSource}>
                    <input type="hidden" name="provider" value={connector.id} />
                    <SubmitButton variant="secondary" aria-label="Synchroniser">
                      <RefreshCw className="h-4 w-4" />
                    </SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
