"use client";

import { useFormStatus } from "react-dom";

const VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-500",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
};

export function SubmitButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: { variant?: keyof typeof VARIANTS } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {pending ? "…" : children}
    </button>
  );
}
