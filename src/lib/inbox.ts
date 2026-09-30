import { CheckCheck, Scale, Send } from "lucide-react";
import type { Notification } from "./types";

export const KIND_META: Record<Notification["kind"], { label: string; plural: string; icon: typeof Scale; color: string }> = {
  review_request: { label: "Validation demandée", plural: "Validations", icon: Scale, color: "text-red-600 bg-red-50" },
  handoff: { label: "Question d'un collègue", plural: "Questions", icon: Send, color: "text-amber-700 bg-amber-50" },
  resolution: { label: "Réponse / décision", plural: "Réponses", icon: CheckCheck, color: "text-emerald-700 bg-emerald-50" },
};
