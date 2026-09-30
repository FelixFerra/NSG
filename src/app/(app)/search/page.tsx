import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, Search, SearchX, Sparkles } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { buildConflictIndex, fetchConflicts, fetchInfos, fetchReferenceData, rankExperts } from "@/lib/data";
import { searchKnowledge, type Answer } from "@/lib/search";
import { sourceName } from "@/lib/connectors";
import type { Client, Context } from "@/lib/types";
import { Badge, formatDate } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { TrustFactors, TrustScore } from "@/components/trust-score";
import { ExpertCard } from "@/components/expert-card";
import { DocumentCard } from "@/components/document-card";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function param(value: string | string[] | undefined, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

const EXAMPLES = ["Quel taux d'indexation appliquer en janvier ?", "Combien de jours de congés ?", "Comment calculer la prime de fin d'année ?"];

export default async function SearchPage(props: PageProps<"/search">) {
  const searchParams = await props.searchParams;
  const question = param(searchParams.q);
  const clientId = UUID_RE.test(param(searchParams.client)) ? param(searchParams.client) : "";
  const contextId = UUID_RE.test(param(searchParams.context)) ? param(searchParams.context) : "";

  const { supabase, employee } = await getCurrentEmployee();
  const [infos, conflicts, { clients, contexts, employees, expertise }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const conflictIndex = buildConflictIndex(conflicts, infos);
  const result =
    question
      ? searchKnowledge({ question, client, contextId, infos, contexts, conflictIndex })
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Pose ta question</h1>
        <p className="mt-2 text-sm text-slate-500">
          Choisis un client pour une réponse adaptée à son pays et à ses accords, ou cherche dans toute la base.
        </p>
      </div>

      <form className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row">
          <label className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 md:w-64">
            <Building2 className="h-4 w-4 shrink-0 text-indigo-600" />
            <span className="sr-only">Client</span>
            <select
              name="client"
              defaultValue={clientId}
              className="w-full bg-transparent py-2.5 text-sm font-medium text-indigo-900 outline-none"
            >
              <option value="">Tous les clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.country})
                </option>
              ))}
            </select>
          </label>
          <label className="md:w-52">
            <span className="sr-only">Sujet</span>
            <select name="context" defaultValue={contextId} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <option value="">Sujet : détection auto</option>
              {contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="relative flex-1">
            <span className="sr-only">Question</span>
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
            <input
              name="q"
              required
              maxLength={300}
              defaultValue={question}
              placeholder="Ex. quel taux d'indexation appliquer en janvier ?"
              className="w-full rounded-lg border border-slate-200 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-indigo-500"
            />
          </label>
          <button className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">
            Rechercher
          </button>
        </div>
      </form>

      {!result && (
        <div className="mt-8 text-center text-sm text-slate-500">
          <p className="mb-3">Exemples :</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <Link
                key={ex}
                href={`/search?q=${encodeURIComponent(ex)}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 hover:border-indigo-300 hover:text-indigo-700"
              >
                {ex}
              </Link>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <p className="text-sm text-slate-500">
            {client ? (
              <>
                Client <strong className="text-slate-800">{client.name}</strong> ({client.country})
              </>
            ) : (
              <>Toute la base, tous clients confondus</>
            )}
            {result.detectedContext && (
              <>
                {" "}· sujet détecté <strong className="text-slate-800">{result.detectedContext.label}</strong>
              </>
            )}
          </p>

          {result.answers.length === 0 ? (
            <NoAnswer
              question={question}
              client={client}
              context={result.detectedContext}
              experts={rankExperts(expertise, employees, { contextId: result.detectedContext?.id, country: client?.country })}
              meId={employee?.id}
            />
          ) : (
            result.answers.map((answer) => (
              <AnswerCard
                key={answer.main.info.id}
                answer={answer}
                question={question}
                client={client}
                experts={
                  answer.conflicts.length > 0
                    ? rankExperts(expertise, employees, { contextId: answer.main.info.context_id, country: client?.country, limit: 2 })
                    : []
                }
                meId={employee?.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AnswerCard({
  answer,
  question,
  client,
  experts,
  meId,
}: {
  answer: Answer;
  question: string;
  client: Client | null;
  experts: ReturnType<typeof rankExperts>;
  meId?: string;
}) {
  const { main } = answer;
  const hasConflict = answer.conflicts.length > 0;
  const handoff = [
    `Question : ${question}`,
    client ? `Client : ${client.name} (${client.country})` : "Client : non précisé",
    `Réponse trouvée : « ${main.info.title} » (${sourceName(main.info.source_type)}, ${formatDate(main.info.source_updated_at)})`,
    ...answer.conflicts.map((c) => `Contredite par : « ${c.other.title} » (${sourceName(c.other.source_type)})`),
    "Peux-tu confirmer la bonne information ?",
  ].join("\n");

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">Réponse la plus probable</span>
          {answer.context && <Badge tone="info">{answer.context.label}</Badge>}
        </div>

        <div className="flex gap-5">
          <div className="min-w-0 flex-1">
            <p className="text-lg leading-relaxed font-medium text-slate-900">{answer.excerpt}</p>
            <p className="mt-2 text-sm text-slate-500">
              Extrait de <span className="font-medium text-slate-700">{main.info.title}</span>
            </p>
          </div>
          <TrustScore trust={main.trust} />
        </div>

        {hasConflict && (
          <div className="mt-5 rounded-xl border-2 border-red-300 bg-red-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold text-red-800">
                <AlertTriangle className="h-5 w-5" /> {answer.conflicts.length + 1} versions se contredisent : ne pas répondre sans vérifier
              </p>
              <Link
                href={`/conflicts/${answer.conflicts[0].conflict.id}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
              >
                Comparer les versions <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="mt-3 space-y-2">
              {answer.conflicts.map(({ conflict, other }) => (
                <li key={conflict.id} className="rounded-lg bg-white/70 px-3 py-2 text-sm text-red-900">
                  <strong>{other.title}</strong> — « {other.content} »{" "}
                  <span className="text-red-700">
                    ({sourceName(other.source_type)}, {other.owner?.full_name ?? "sans auteur"}, {formatDate(other.source_updated_at)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 md:px-6">
        <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Preuves de fiabilité</p>
        <TrustPills info={main.info} conflicts={answer.conflicts.length} />
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900">
            Pourquoi {main.trust.score}/100 ?
          </summary>
          <div className="mt-3 max-w-xl rounded-md bg-white p-3 ring-1 ring-slate-200">
            <TrustFactors trust={main.trust} />
          </div>
        </details>

        {answer.others.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-900">
              {answer.others.length} autre(s) source(s) sur ce sujet
            </summary>
            <div className="mt-3 space-y-3">
              {answer.others.map((o) => (
                <DocumentCard key={o.info.id} info={o.info} trust={o.trust} />
              ))}
            </div>
          </details>
        )}
      </div>

      {experts.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 md:px-6">
          <p className="mb-3 text-sm font-medium text-slate-700">Conflit non résolu : demande à un expert</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {experts.map((x) => (
              <ExpertCard
                key={x.employee.id}
                expert={x.employee}
                score={x.score}
                authority={x.authority}
                topic={answer.context?.label ?? null}
                handoffMessage={handoff}
                clientId={client?.id}
                contextId={main.info.context_id}
                conflictId={answer.conflicts[0]?.conflict.id}
                isMe={x.employee.id === meId}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function NoAnswer({
  question,
  client,
  context,
  experts,
  meId,
}: {
  question: string;
  client: Client | null;
  context: Context | null;
  experts: ReturnType<typeof rankExperts>;
  meId?: string;
}) {
  const handoff = [
    `Question : ${question}`,
    client ? `Client : ${client.name} (${client.country})` : null,
    context ? `Sujet : ${context.label}` : null,
    "Aucun document fiable trouvé dans la base de savoir. Peux-tu m'aider ?",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="flex items-center gap-2 font-medium">
        <SearchX className="h-5 w-5 text-slate-400" /> Aucune réponse documentée{client ? ` pour ${client.name}` : " dans la base"}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        Plutôt que de deviner, voici {experts.length > 1 ? "les experts les plus qualifiés" : "l'expert le plus qualifié"}
        {context ? ` en ${context.label.toLowerCase()}` : ""}.
      </p>
      {experts.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {experts.map((x) => (
            <ExpertCard
              key={x.employee.id}
              expert={x.employee}
              score={x.score}
              authority={x.authority}
              topic={context?.label ?? null}
              handoffMessage={handoff}
              clientId={client?.id}
              contextId={context?.id}
              isMe={x.employee.id === meId}
            />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Aucun expert identifié sur ce sujet pour l&apos;instant.</p>
      )}
    </div>
  );
}
