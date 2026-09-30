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
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Score de confiance explicable (0-100) : chaque point est justifié par un facteur visible.
 * `targetCountry` = pays du client / de la question, si connu.
 */
export function computeTrust(
  info: InfoWithRelations,
  all: InfoWithRelations[],
  targetCountry?: string | null,
  now: Date = new Date(),
): TrustResult {
  const factors: TrustFactor[] = [];

  // 1. Fraîcheur (30)
  const ageDays = Math.floor((now.getTime() - new Date(info.source_updated_at).getTime()) / DAY);
  const expired = info.valid_until !== null && new Date(info.valid_until) < now;
  if (expired || info.status === "archived") {
    factors.push({ label: "Fraîcheur", detail: expired ? `Validité expirée le ${info.valid_until}` : "Document archivé", points: 0, max: 30, tone: "bad" });
  } else if (ageDays <= 90) {
    factors.push({ label: "Fraîcheur", detail: `Mis à jour il y a ${ageDays} j`, points: 30, max: 30, tone: "good" });
  } else if (ageDays <= 365) {
    factors.push({ label: "Fraîcheur", detail: `Mis à jour il y a ${ageDays} j`, points: 15, max: 30, tone: "warn" });
  } else {
    factors.push({ label: "Fraîcheur", detail: `Plus d'un an (${ageDays} j)`, points: 0, max: 30, tone: "bad" });
  }

  // 2. Propriétaire identifié (25)
  factors.push(
    info.owner
      ? { label: "Propriétaire", detail: `${info.owner.full_name}${info.owner.job_title ? ` — ${info.owner.job_title}` : ""}`, points: 25, max: 25, tone: "good" }
      : { label: "Propriétaire", detail: "Aucun propriétaire : personne ne maintient cette info", points: 0, max: 25, tone: "bad" },
  );

  // 3. Type de source (20)
  const reliability = sourceReliability(info.source_type);
  factors.push({
    label: "Source",
    detail: `${sourceName(info.source_type)}${reliability >= 15 ? " (référentiel officiel)" : reliability >= 8 ? " (échange écrit)" : " (conversation informelle)"}`,
    points: reliability,
    max: 20,
    tone: reliability >= 15 ? "good" : reliability >= 8 ? "warn" : "bad",
  });

  // 4. Périmètre pays / client (25)
  const country = targetCountry ?? info.client?.country ?? null;
  if (info.client) {
    factors.push({ label: "Périmètre", detail: `Spécifique au client ${info.client.name}`, points: 25, max: 25, tone: "good" });
  } else if (!country || !info.country) {
    factors.push({ label: "Périmètre", detail: info.country ? `Pays : ${info.country}` : "Pays non précisé", points: 12, max: 25, tone: "warn" });
  } else if (country === info.country) {
    factors.push({ label: "Périmètre", detail: `Valable pour ${info.country}`, points: 20, max: 25, tone: "good" });
  } else {
    factors.push({ label: "Périmètre", detail: `Concerne ${info.country}, pas ${country}`, points: 0, max: 25, tone: "bad" });
  }

  // Conflits : autres infos actives sur le même sujet et le même pays
  const conflicts = all.filter(
    (other) =>
      other.id !== info.id &&
      other.status === "active" &&
      other.context_id !== null &&
      other.context_id === info.context_id &&
      other.country === info.country &&
      other.content.trim() !== info.content.trim(),
  );

  const score = Math.max(0, Math.min(100, factors.reduce((sum, f) => sum + f.points, 0) - (conflicts.length > 0 ? 10 : 0)));
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return { score, level, factors, conflicts };
}
