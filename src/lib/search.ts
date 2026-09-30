import type { Client, Conflict, Context, InfoWithRelations } from "./types";
import type { ConflictIndex } from "./data";
import { computeTrust, type TrustResult } from "./trust";

const STOPWORDS = new Set(
  (
    "les des une pour que qui quoi est sont pas plus avec dans sur par aux ces ses son sa mon mes notre nos vos votre leur leurs " +
    "quel quelle quels quelles combien comment quand faut doit peut elle ils nous vous cette cet ete etre avoir fait faire " +
    "chez client clients entre sans tout tous toute toutes applique appliquer applicable " +
    "the and for what how does which with from this that are"
  ).split(" "),
);

export function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function tokenize(text: string) {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function sameWord(a: string, b: string) {
  if (a === b) return true;
  // Tolérance pluriel / dérivés : « conge » ~ « conges », « index » ~ « indexation »
  return a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
}

function overlap(queryTokens: string[], words: string[]) {
  return queryTokens.filter((q) => words.some((w) => sameWord(q, w))).length;
}

export function detectContext(question: string, contexts: Context[]) {
  const tokens = tokenize(question);
  let best: { context: Context; hits: number } | null = null;
  for (const context of contexts) {
    const words = tokenize([context.label, context.slug, ...context.keywords].join(" "));
    const hits = overlap(tokens, words);
    if (hits > 0 && (!best || hits > best.hits)) best = { context, hits };
  }
  return best?.context ?? null;
}

/** Infos applicables à un client : les siennes + les générales de son pays. */
export function inClientScope(info: InfoWithRelations, client: Client | null) {
  if (!client) return true; // recherche sans client : toute la base
  if (info.client_id) return info.client_id === client.id;
  return !info.country || !client.country || info.country === client.country;
}

function bestSentence(content: string, tokens: string[]) {
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
  let best = sentences[0] ?? content;
  let bestHits = -1;
  for (const s of sentences) {
    const hits = overlap(tokens, tokenize(s));
    if (hits > bestHits) {
      best = s;
      bestHits = hits;
    }
  }
  return best;
}

export type ScoredInfo = { info: InfoWithRelations; trust: TrustResult; relevance: number };

export type Answer = {
  context: InfoWithRelations["context"];
  main: ScoredInfo;
  excerpt: string;
  /** Autres sources sur le même sujet, y compris périmées, jamais masquées. */
  others: ScoredInfo[];
  conflicts: { conflict: Conflict; other: InfoWithRelations }[];
};

export function searchKnowledge(params: {
  question: string;
  client: Client | null;
  contextId?: string | null;
  infos: InfoWithRelations[];
  contexts: Context[];
  conflictIndex: ConflictIndex;
}) {
  const { question, client, infos, contexts, conflictIndex } = params;
  const tokens = tokenize(question);
  const detected =
    contexts.find((c) => c.id === params.contextId) ?? detectContext(question, contexts);

  const scored: ScoredInfo[] = infos
    .filter((info) => info.status !== "rejected" && inClientScope(info, client))
    .filter((info) => !detected || info.context_id === detected.id)
    .map((info) => {
      const words = tokenize(`${info.title} ${info.content} ${info.source_label ?? ""} ${info.context?.label ?? ""}`);
      const relevance = overlap(tokens, words) + (detected && info.context_id === detected.id ? 2 : 0);
      const conflicts = (conflictIndex.get(info.id) ?? []).map((c) => c.other);
      return { info, relevance, trust: computeTrust(info, conflicts, client?.country ?? null) };
    })
    .filter((s) => s.relevance > 0);

  // Une carte de réponse par sujet ; réponse principale = la plus probable
  const groups = new Map<string, ScoredInfo[]>();
  for (const s of scored) {
    const key = s.info.context_id ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const answers: Answer[] = [...groups.values()]
    .map((group) => {
      const sorted = [...group].sort(
        (a, b) =>
          Number(b.trust.usable) - Number(a.trust.usable) ||
          b.trust.score - a.trust.score ||
          b.relevance - a.relevance,
      );
      const main = sorted[0];
      return {
        context: main.info.context,
        main,
        excerpt: bestSentence(main.info.content, tokens),
        others: sorted.slice(1),
        conflicts: conflictIndex.get(main.info.id) ?? [],
      };
    })
    .sort((a, b) => Math.max(b.main.relevance, ...b.others.map((o) => o.relevance)) - Math.max(a.main.relevance, ...a.others.map((o) => o.relevance)))
    .slice(0, 3);

  return { detectedContext: detected ?? null, answers };
}
