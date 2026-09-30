"use client";

import { useActionState } from "react";
import { Mail, Send, Check } from "lucide-react";
import { requestExpertHelp, type ActionState } from "@/app/(app)/actions";

export type ExpertCardProps = {
  expert: { id: string; full_name: string; job_title: string | null; email: string; country: string | null };
  score: number;
  authority: { label: string; tone: "good" | "info" | "neutral" };
  topic: string | null;
  /** Contexte de l'impasse transféré à l'expert. */
  handoffMessage: string;
  clientId?: string | null;
  contextId?: string | null;
  isMe?: boolean;
};

const TONES = {
  good: "bg-emerald-50 text-emerald-700",
  info: "bg-indigo-50 text-indigo-700",
  neutral: "bg-slate-100 text-slate-600",
};

export function ExpertCard(props: ExpertCardProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestExpertHelp, {});
  const { expert } = props;
  const initials = expert.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const mailto = `mailto:${expert.email}?subject=${encodeURIComponent(`Question : ${props.topic ?? "base de savoir"}`)}&body=${encodeURIComponent(props.handoffMessage)}`;

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{expert.full_name}</p>
          <p className="truncate text-xs text-slate-500">
            {[expert.job_title, expert.country].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${TONES[props.authority.tone]}`}>
            {props.authority.label}
          </span>
          <span className="text-slate-500">
            {props.score} pts{props.topic ? ` · ${props.topic}` : ""}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, props.score * 7)}%` }} />
        </div>
      </div>

      {props.isMe ? (
        <p className="mt-3 text-xs text-slate-500">C&apos;est toi : tu es l&apos;expert le plus qualifié ici.</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <form action={action} className="flex-1">
            <input type="hidden" name="expert_id" value={expert.id} />
            <input type="hidden" name="message" value={props.handoffMessage} />
            {props.clientId && <input type="hidden" name="client_id" value={props.clientId} />}
            {props.contextId && <input type="hidden" name="context_id" value={props.contextId} />}
            <button
              disabled={pending || state.ok}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {state.ok ? <><Check className="h-3.5 w-3.5" /> Contexte transféré</> : <><Send className="h-3.5 w-3.5" /> Transférer le contexte</>}
            </button>
          </form>
          <a href={mailto} aria-label="Écrire un e-mail" className="flex items-center rounded-md border border-slate-300 px-2.5 text-slate-600 hover:bg-slate-50">
            <Mail className="h-4 w-4" />
          </a>
        </div>
      )}
      {state.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
