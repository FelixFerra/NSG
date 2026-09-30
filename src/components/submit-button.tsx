"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: "primary" | "secondary" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-500"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${styles} ${className}`}
      {...rest}
    >
      {pending ? "…" : children}
    </button>
  );
}
