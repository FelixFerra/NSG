"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** <details> qui se referme à chaque navigation ou clic à l'extérieur. */
export function Popover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary className="list-none [&::-webkit-details-marker]:hidden">{trigger}</summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-lg">
        {children}
      </div>
    </details>
  );
}
