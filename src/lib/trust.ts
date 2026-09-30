import { sourceName, sourceReliability } from "./connectors";
import type { InfoWithRelations } from "./types";

export type TrustFactor = {
  label: string;
  detail: string;
  points: number;
  max: number;
  tone: "good" | "warn" | "bad";
};

export type TrustResult = {
  score: number;
  level: "high" | "medium" | "low";
  factors: TrustFactor[];
  conflicts: InfoWithRelations[];
  usable: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

export function isExpired(info: InfoWithRelations, now: Date = new Date()) {
  return info.valid_until !== null && new Date(info.valid_until) < now;
}

/** Une info « utilisable » peut servir de réponse principale. */
export function isUsable(info: InfoWithRelations, now: Date = new Date()) {
  return info.status === "active" && !info.superseded_by && !isExpired(info, now);
}

/**
 * Score de confiance explicable (0-100) : chaque point est justifié par un facteur visible.
 * `conflicts` = infos qui contredisent celle-ci (conflits en attente).
 * `targetCountry` = pays du client / de la question, si connu.
 */
export function computeTrust(
  info: InfoWithRelations,
  conflicts: InfoWithRelations[] = [],
  targetCountry?: string | null,
  now: Date = new Date(),
): TrustResult {
  const factors: TrustFactor[] = [];

  // 1. Fraîcheur (25)
  const ageDays = Math.floor((now.getTime() - new Date(info.source_updated_at).getTime()) / DAY);
  if (info.status === "rejected") {
    factors.push({ label: "Fraîcheur", detail: "Rejetée lors d'une validation", points: 0, max: 25, tone: "bad" });
  } else if (info.superseded_by || info.status === "archived") {
    factors.push({ label: "Fraîcheur", detail: info.superseded_by ? "Remplacée par une info plus récente" : "Document archivé", points: 0, max: 25, tone: "bad" });
  } else if (isExpired(info, now)) {
    factors.push({ label: "Fraîcheur", detail: `Validité expirée le ${info.valid_until}`, points: 0, max: 25, tone: "bad" });
  } else if (ageDays <= 90) {
    factors.push({ label: "Fraîcheur", detail: `Mise à jour il y a ${ageDays} j`, points: 25, max: 25, tone: "good" });
  } else if (ageDays <= 365) {
    factors.push({ label: "Fraîcheur", detail: `Mise à jour il y a ${ageDays} j`, points: 12, max: 25, tone: "warn" });
  } else {
    factors.push({ label: "Fraîcheur", detail: `Plus d'un an (${ageDays} j)`, points: 0, max: 25, tone: "bad" });
  }

  // 2. Auteur identifié (20)
  factors.push(
    info.owner
      ? { label: "Auteur", detail: `${info.owner.full_name}${info.owner.job_title ? ` — ${info.owner.job_title}` : ""}`, points: 20, max: 20, tone: "good" }
      : { label: "Auteur", detail: "Aucun auteur : personne ne maintient cette info", points: 0, max: 20, tone: "bad" },
  );

  // 3. Statut officiel + signature (20)
  const statusPoints = (info.is_official ? 12 : 0) + (info.is_signed ? 8 : 0);
  factors.push({
    label: "Statut",
    detail: [info.is_official ? "Document officiel" : "Non officiel", info.is_signed ? "signé" : "non signé"].join(", "),
    points: statusPoints,
    max: 20,
    tone: statusPoints >= 12 ? "good" : statusPoints > 0 ? "warn" : "bad",
  });

  // 4. Type de source (15)
  const reliability = sourceReliability(info.source_type);
  factors.push({
    label: "Source",
    detail: `${sourceName(info.source_type)}${reliability >= 12 ? " (référentiel documentaire)" : reliability >= 6 ? " (échange écrit)" : " (conversation informelle)"}`,
    points: reliability,
    max: 15,
    tone: reliability >= 12 ? "good" : reliability >= 6 ? "warn" : "bad",
  });

  // 5. Périmètre pays / client (20)
  const country = targetCountry ?? null;
  if (info.client) {
    factors.push({ label: "Périmètre", detail: `Spécifique au client ${info.client.name}`, points: 20, max: 20, tone: "good" });
  } else if (!country || !info.country) {
    factors.push({ label: "Périmètre", detail: info.country ? `Pays : ${info.country}` : "Pays non précisé", points: 8, max: 20, tone: "warn" });
  } else if (country === info.country) {
    factors.push({ label: "Périmètre", detail: `Valable pour ${info.country}`, points: 15, max: 20, tone: "good" });
  } else {
    factors.push({ label: "Périmètre", detail: `Concerne ${info.country}, pas ${country}`, points: 0, max: 20, tone: "bad" });
  }

  const raw = factors.reduce((sum, f) => sum + f.points, 0) - (conflicts.length > 0 ? 10 : 0);
  const score = Math.max(0, Math.min(100, raw));
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return { score, level, factors, conflicts, usable: isUsable(info, now) };
}

// ---------------------------------------------------------------------------
// Faits chiffrés — même règle que public.info_facts() côté SQL
// ---------------------------------------------------------------------------
const FACT_RE = /(\d+(?:[.,]\d+)?)\s*(%|€|eur|jours?|days?|tage|mois|months?)/gi;

function factKey(num: string, unit: string) {
  const u = unit.toLowerCase();
  const suffix = u === "%" ? "%" : u === "€" || u === "eur" ? "€" : u.startsWith("mo") ? "m" : "j";
  return num.replace(",", ".") + suffix;
}

export function extractFacts(text: string): string[] {
  return [...new Set([...text.matchAll(FACT_RE)].map((m) => factKey(m[1], m[2])))].sort();
}

/** Découpe un texte en segments, en marquant les faits absents de l'autre version. */
export function highlightDisagreement(text: string, otherText: string) {
  const other = new Set(extractFacts(otherText));
  const segments: { text: string; mark: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(FACT_RE)) {
    const start = m.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), mark: false });
    segments.push({ text: m[0], mark: !other.has(factKey(m[1], m[2])) });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), mark: false });
  return segments;
}
