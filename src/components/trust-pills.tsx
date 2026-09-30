import { BadgeCheck, CalendarClock, CalendarX, Globe, PenLine, UserRound, UserX, Archive, Building2, Ban } from "lucide-react";
import { sourceName } from "@/lib/connectors";
import { isExpired } from "@/lib/trust";
import type { InfoWithRelations } from "@/lib/types";
import { Badge, formatDate } from "./ui";
import { ConnectorLogo } from "./connector-logo";

/** Métadonnées qui prouvent (ou non) la valeur d'une info, en pastilles. */
export function TrustPills({ info }: { info: InfoWithRelations }) {
  const expired = isExpired(info);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pr-2 pl-0.5 text-xs font-medium text-slate-700">
        <ConnectorLogo id={info.source_type} size="xs" />
        {sourceName(info.source_type)}
      </span>

      {info.is_official ? (
        <Badge tone="good"><BadgeCheck className="h-3 w-3" /> Document officiel</Badge>
      ) : (
        <Badge tone="warn">Non officiel</Badge>
      )}

      {info.is_signed ? (
        <Badge tone="good"><PenLine className="h-3 w-3" /> Signé</Badge>
      ) : (
        <Badge>Non signé</Badge>
      )}

      {info.owner ? (
        <Badge><UserRound className="h-3 w-3" /> {info.owner.full_name}</Badge>
      ) : (
        <Badge tone="bad"><UserX className="h-3 w-3" /> Sans auteur</Badge>
      )}

      <Badge><CalendarClock className="h-3 w-3" /> MAJ {formatDate(info.source_updated_at)}</Badge>

      {expired ? (
        <Badge tone="bad"><CalendarX className="h-3 w-3" /> Expiré le {formatDate(info.valid_until)}</Badge>
      ) : info.valid_until ? (
        <Badge>Valide jusqu&apos;au {formatDate(info.valid_until)}</Badge>
      ) : null}

      {info.client ? (
        <Badge tone="info"><Building2 className="h-3 w-3" /> {info.client.name}</Badge>
      ) : info.country ? (
        <Badge><Globe className="h-3 w-3" /> {info.country}</Badge>
      ) : null}

      {info.superseded_by ? (
        <Badge tone="bad"><Archive className="h-3 w-3" /> Remplacée</Badge>
      ) : info.status === "archived" ? (
        <Badge tone="bad"><Archive className="h-3 w-3" /> Archivée</Badge>
      ) : info.status === "rejected" ? (
        <Badge tone="bad"><Ban className="h-3 w-3" /> Rejetée</Badge>
      ) : null}
    </div>
  );
}
