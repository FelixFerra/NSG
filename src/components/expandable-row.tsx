"use client";

import { useState } from "react";

/**
 * Ligne de tableau qui se déplie au clic : le détail s'affiche dans une
 * seconde ligne qui occupe toute la largeur du tableau.
 * Les liens et boutons de la ligne gardent leur propre comportement.
 */
export function ExpandableRow({
  cells,
  detail,
  colSpan,
  className = "",
}: {
  cells: React.ReactNode;
  detail: React.ReactNode;
  colSpan: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function onClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("a, button, input, select, textarea, form")) return;
    if (window.getSelection()?.toString()) return;
    setOpen((o) => !o);
  }

  return (
    <>
      <tr
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        tabIndex={0}
        aria-expanded={open}
        className={`group cursor-pointer outline-none focus-visible:bg-indigo-50 ${open ? "bg-indigo-50/60" : "hover:bg-slate-50"} ${className}`}
      >
        {cells}
      </tr>
      {open && (
        <tr className="bg-indigo-50/30">
          <td colSpan={colSpan} className="px-4 pt-1 pb-5">
            {detail}
          </td>
        </tr>
      )}
    </>
  );
}
