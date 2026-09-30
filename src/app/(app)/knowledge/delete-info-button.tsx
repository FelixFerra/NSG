"use client";

import { Trash2 } from "lucide-react";
import { deleteInfo } from "./actions";

/** Supprime une de ses infos après confirmation. */
export function DeleteInfoButton({ infoId, title, compact = false }: { infoId: string; title: string; compact?: boolean }) {
  return (
    <form
      action={deleteInfo}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer définitivement « ${title} » ?\nLes conflits liés seront aussi supprimés.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="info_id" value={infoId} />
      <button
        className={`inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white font-medium text-red-600 hover:bg-red-50 ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
        }`}
      >
        <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> Supprimer
      </button>
    </form>
  );
}
