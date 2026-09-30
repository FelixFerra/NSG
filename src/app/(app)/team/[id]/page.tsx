import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { authorityOf, buildConflictIndex, fetchConflicts, fetchInfos, fetchReferenceData } from "@/lib/data";
import { computeTrust } from "@/lib/trust";
import { Badge, Card, EmptyState, formatDate } from "@/components/ui";
import { TrustPills } from "@/components/trust-pills";
import { AskExpertForm } from "@/components/ask-expert-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ExpertProfilePage(props: PageProps<"/team/[id]">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, employee: me } = await getCurrentEmployee();
  const [infos, conflicts, { clients, contexts, employees, expertise }] = await Promise.all([
    fetchInfos(supabase),
    fetchConflicts(supabase),
    fetchReferenceData(supabase),
  ]);
  const person = employees.find((e) => e.id === id);
  if (!person) notFound();

  const index = buildConflictIndex(conflicts, infos);
  const scores = expertise.filter((x) => x.employee_id === id && x.score > 0).sort((a, b) => b.score - a.score);
  const total = scores.reduce((s, x) => s + x.score, 0);
  const authored = infos.filter((i) => i.employee_id === id);
  const followed = clients.filter((c) => c.account_owner_id === id);
  const resolved = conflicts.filter((c) => c.resolved_by === id);
  const toReview = conflicts.filter((c) => c.status === "pending" && c.assignee_id === id);
  const contextLabel = (cid: string | null) => contexts.find((c) => c.id === cid)?.label ?? "—";
  const isMe = me?.id === id;

  return (
    <div className="max-w-5xl">
      <Link href="/team" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Tous les collaborateurs
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-lg font-semibold text-indigo-700">
            {person.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">
              {person.full_name} {isMe && <span className="text-sm font-normal text-slate-400">(toi)</span>}
            </h1>
            <p className="text-sm text-slate-500">{[person.job_title, person.department, person.country].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={authorityOf(total).tone}>{authorityOf(total).label} · {total} pts</Badge>
            <a href={`mailto:${person.email}`} className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
              <Mail className="h-4 w-4" /> {person.email}
            </a>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
          <Metric label="Infos publiées" value={authored.length} />
          <Metric label="Conflits tranchés" value={resolved.length} />
          <Metric label="Validations en attente" value={toReview.length} />
          <Metric label="Clients suivis" value={followed.length} />
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 font-medium">Expertise par domaine</h2>
            {scores.length === 0 ? (
              <p className="text-sm text-slate-400">Pas encore de score.</p>
            ) : (
              <ul className="space-y-3">
                {scores.map((s) => (
                  <li key={s.context_id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{contextLabel(s.context_id)}</span>
                      <span className="text-slate-500">{authorityOf(s.score).label} · {s.score} pts</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, s.score * 7)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-medium">Clients suivis</h2>
            {followed.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {followed.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="text-indigo-600 hover:underline">{c.name}</Link>{" "}
                    <span className="text-slate-400">({c.country})</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {!isMe && (
            <Card>
              <h2 className="mb-3 font-medium">Poser une question à {person.full_name.split(" ")[0]}</h2>
              <AskExpertForm expertId={person.id} expertName={person.full_name} clients={clients} contexts={contexts} />
            </Card>
          )}
        </div>

        <Card>
          <h2 className="mb-3 font-medium">Infos publiées</h2>
          {authored.length === 0 ? (
            <EmptyState>Aucune info publiée.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {authored.map((info) => {
                const trust = computeTrust(info, (index.get(info.id) ?? []).map((c) => c.other), info.client?.country ?? info.country);
                return (
                  <li key={info.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{info.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {info.context?.label ?? "—"} · {formatDate(info.source_updated_at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">{trust.score}/100</span>
                    </div>
                    <div className="mt-2">
                      <TrustPills info={info} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
