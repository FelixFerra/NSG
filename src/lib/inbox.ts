import { CheckCheck, Scale, Send } from "lucide-react";
import type { Notification } from "./types";

export const KIND_META: Record<
  Notification["kind"],
  { label: string; plural: string; icon: typeof Scale; text: string; bar: string; pill: string }
> = {
  review_request: {
    label: "Validation",
    plural: "Validations",
    icon: Scale,
    text: "text-red-600",
    bar: "border-l-red-500",
    pill: "bg-red-50 text-red-700",
  },
  handoff: {
    label: "Question",
    plural: "Questions",
    icon: Send,
    text: "text-amber-600",
    bar: "border-l-amber-500",
    pill: "bg-amber-50 text-amber-700",
  },
  resolution: {
    label: "Réponse",
    plural: "Réponses",
    icon: CheckCheck,
    text: "text-emerald-600",
    bar: "border-l-emerald-500",
    pill: "bg-emerald-50 text-emerald-700",
  },
};

/** Objet lisible d'une notification (comme l'objet d'un e-mail) + aperçu. */
export function describeNotification(
  n: Pick<Notification, "kind" | "message" | "client_id" | "context_id">,
  names: { clients: Record<string, string>; contexts: Record<string, string> },
) {
  const where = [n.context_id && names.contexts[n.context_id], n.client_id && names.clients[n.client_id]]
    .filter(Boolean)
    .join(" · ");
  const lines = n.message.split("\n").map((l) => l.trim()).filter(Boolean);

  if (n.kind === "review_request") {
    return { subject: `Contradiction à valider${where ? ` — ${where}` : ""}`, preview: n.message, where };
  }
  if (n.kind === "handoff") {
    const subject = (lines[0] ?? "Demande d'aide").replace(/^Question\s*:\s*/i, "");
    return { subject, preview: lines.slice(1).join(" · ") || where, where };
  }
  return { subject: lines[0] ?? "Réponse", preview: lines.slice(1).join(" ") || where, where };
}
