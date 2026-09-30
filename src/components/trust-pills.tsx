import Link from "next/link";
import { AlertTriangle, Archive, Ban, BadgeCheck, CalendarX, PenLine, UserX } from "lucide-react";
import { sourceName } from "@/lib/connectors";
import { isExpired } from "@/lib/trust";
import type { InfoWithRelations } from "@/lib/types";
import { formatDate } from "./ui";
import { ConnectorLogo } from "./connector-logo";

/**
 * Preuves de fiabilité d'une info, en deux niveaux :
 * 1. une ligne de métadonnées sobre (source · auteur · date · périmètre) ;
 * 2. des signaux colorés, affichés seulement s'ils existent (officiel, signé, expiré…).
 */
export function TrustPills({ info, conflicts = 0 }: { info: InfoWithRelations; conflicts?: number }) {
  return (
    <div className="space-y-1.5">
      <DocMeta info={info} />
      <DocSignals info={info} conflicts={conflicts} />
    </div>
  );
}

export function DocMeta({ info }: { info: InfoWithRelations }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
        <ConnectorLogo id={info.source_type} size="xs" />
        {sourceName(info.source_type)}
      </span>
      {info.source_label && <span className="max-w-64 truncate" title={info.source_label}>{info.source_label}</span>}
      <Dot />
      {info.owner ? (
        <Link href={`/team/${info.owner.id}`} className="hover:text-indigo-700 hover:underline">
          {info.owner.full_name}
        </Link>
      ) : (
        <span className="text-red-600">Sans auteur</span>
      )}
      <Dot />
      <span>MAJ {formatDate(info.source_updated_at)}</span>
      <Dot />
      {info.client ? (
        <Link href={`/clients/${info.client.id}`} className="hover:text-indigo-700 hover:underline">
          {info.client.name}
        </Link>
      ) : (
        <span>{info.country ? `Général · ${info.country}` : "Général"}</span>
      )}
    </p>
  );
}

export function DocSignals({ info, conflicts = 0 }: { info: InfoWithRelations; conflicts?: number }) {
  const signals: { key: string; icon: typeof BadgeCheck; label: string; tone: "good" | "bad" }[] = [];
  if (info.is_official) signals.push({ key: "official", icon: BadgeCheck, label: "Document officiel", tone: "good" });
  if (info.is_signed) signals.push({ key: "signed", icon: PenLine, label: "Signé", tone: "good" });
  if (conflicts > 0) signals.push({ key: "conflict", icon: AlertTriangle, label: `${conflicts} contradiction(s)`, tone: "bad" });
  if (!info.owner) signals.push({ key: "owner", icon: UserX, label: "Personne ne la maintient", tone: "bad" });
  if (info.superseded_by) signals.push({ key: "sup", icon: Archive, label: "Remplacée", tone: "bad" });
  else if (info.status === "archived") signals.push({ key: "arch", icon: Archive, label: "Archivée", tone: "bad" });
  if (info.status === "rejected") signals.push({ key: "rej", icon: Ban, label: "Rejetée", tone: "bad" });
  if (isExpired(info)) signals.push({ key: "exp", icon: CalendarX, label: `Expirée le ${formatDate(info.valid_until)}`, tone: "bad" });

  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {signals.map(({ key, icon: Icon, label, tone }) => (
        <span
          key={key}
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${
            tone === "good" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          <Icon className="h-3 w-3" /> {label}
        </span>
      ))}
    </div>
  );
}

function Dot() {
  return <span className="text-slate-300">·</span>;
}
