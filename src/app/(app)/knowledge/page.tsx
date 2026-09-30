import { AlertTriangle, ExternalLink, Mail, Search } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData, findExpert } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { sourceName } from "@/lib/connectors";
import { Badge, Card, EmptyState, PageHeader, formatDate } from "@/components/ui";
import { ConnectorLogo } from "@/components/connector-logo";
import { TrustFactors, TrustScore } from "@/components/trust-score";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

export default async function KnowledgePage(props: PageProps<"/knowledge">) {
  const searchParams = await props.searchParams;
  const q = param(searchParams.q).toLowerCase();
  const clientId = UUID_RE.test(param(searchParams.client)) ? param(searchParams.client) : "";
  const contextId = UUID_RE.test(param(searchParams.context)) ? param(searchParams.context) : "";

  const { supabase } = await getCurrentEmployee();
  const [infos, { clients, contexts, employees }] = await Promise.all([
    fetchInfos(supabase),
    fetchReferenceData(supabase),
  ]);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const targetCountry = client?.country ?? null;

  const results = infos
    .filter((i) => !contextId || i.context_id === contextId)
    // Pour un client : ses infos spécifiques + les infos générales
    .filter((i) => !client || i.client_id === null || i.client_id === client.id)
    .filter((i) => !q || `${i.title} ${i.content} ${i.source_label ?? ""}`.toLowerCase().includes(q))
    .map((info) => ({ info, trust: computeTrust(info, infos, targetCountry) }))
    .sort((a, b) => b.trust.score - a.trust.score);

  return (
    <>
      <PageHeader
        title="Base de savoir"
        subtitle="Chaque réponse montre pourquoi on peut (ou non) s'y fier."
      />

      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_200px_200px_auto]">
        <label className="relative">
          <span className="sr-only">Recherche</span>
          <Search className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
          <input
            name="q"
            defaultValue={param(searchParams.q)}
            placeholder="Ex. indexation, congés, prime…"
            className="w-full rounded-md border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-500"
          />
        </label>
        <select name="client" defaultValue={clientId} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous les clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.country})
            </option>
          ))}
        </select>
        <select name="context" defaultValue={contextId} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous les sujets</option>
          {contexts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          Filtrer
        </button>
      </form>

      {results.length === 0 ? (
        <EmptyState>Aucune info trouvée. Connecte plus de sources ou élargis ta recherche.</EmptyState>
      ) : (
        <div className="space-y-4">
          {results.map(({ info, trust }) => {
            const expert = findExpert(info, employees, targetCountry);
            return (
              <Card key={info.id}>
                <div className="flex gap-5">
                  <TrustScore trust={trust} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{info.title}</h2>
                      {info.context && <Badge tone="info">{info.context.label}</Badge>}
                      {info.country && <Badge>{info.country}</Badge>}
                      {info.client && <Badge tone="good">{info.client.name}</Badge>}
                      {info.status === "archived" && <Badge tone="bad">Archivé</Badge>}
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{info.content}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <ConnectorLogo id={info.source_type} size="sm" />
                        {sourceName(info.source_type)}
                        {info.source_label && <span className="text-slate-400">· {info.source_label}</span>}
                      </span>
                      <span>Mis à jour le {formatDate(info.source_updated_at)}</span>
                      {info.source_url?.startsWith("https://") && (
                        <a href={info.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline">
                          Ouvrir <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <details className="mt-4 rounded-lg bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        Pourquoi ce score ?
                      </summary>
                      <div className="mt-3">
                        <TrustFactors trust={trust} />
                      </div>
                    </details>

                    {trust.conflicts.length > 0 && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                        <p className="flex items-center gap-1.5 font-medium text-red-800">
                          <AlertTriangle className="h-4 w-4" /> Informations contradictoires
                        </p>
                        <ul className="mt-2 space-y-1 text-red-900">
                          {trust.conflicts.map((c) => (
                            <li key={c.id}>
                              <span className="font-medium">{c.title}</span>{" "}
                              <span className="text-red-700">
                                ({sourceName(c.source_type)}, {formatDate(c.source_updated_at)})
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {expert && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span>Expert à contacter :</span>
                        <span className="font-medium text-slate-900">{expert.full_name}</span>
                        {expert.job_title && <span className="text-slate-400">· {expert.job_title}</span>}
                        <a href={`mailto:${expert.email}`} className="flex items-center gap-1 text-indigo-600 hover:underline">
                          <Mail className="h-3.5 w-3.5" /> {expert.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
