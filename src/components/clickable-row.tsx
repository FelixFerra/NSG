"use client";

import { useRouter } from "next/navigation";

/**
 * Ligne de tableau cliquable partout : ouvre `href`, ou à défaut déplie le
 * premier <details> de la ligne. Les liens et boutons internes gardent leur
 * propre comportement (le nom reste un vrai lien pour le clavier).
 */
export function ClickableRow({
  href,
  className = "",
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function onClick(e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, summary, form")) return;
    if (window.getSelection()?.toString()) return; // sélection de texte en cours
    if (href) {
      if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
      else router.push(href);
      return;
    }
    const details = e.currentTarget.querySelector("details");
    if (details) details.open = !details.open;
  }

  return (
    <tr onClick={onClick} className={`cursor-pointer hover:bg-slate-50 ${className}`}>
      {children}
    </tr>
  );
}
