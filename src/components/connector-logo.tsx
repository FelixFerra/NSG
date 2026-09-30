import { Mail, MessagesSquare, FolderOpen, FileText, BookOpen, Cloud, Hash, HardDrive } from "lucide-react";
import type { SourceType } from "@/lib/types";

const LOGOS: Record<SourceType, { icon: typeof Mail; color: string }> = {
  outlook:      { icon: Mail,           color: "bg-sky-100 text-sky-700" },
  gmail:        { icon: Mail,           color: "bg-red-100 text-red-600" },
  teams:        { icon: MessagesSquare, color: "bg-violet-100 text-violet-700" },
  slack:        { icon: Hash,           color: "bg-fuchsia-100 text-fuchsia-700" },
  sharepoint:   { icon: FolderOpen,     color: "bg-teal-100 text-teal-700" },
  onedrive:     { icon: Cloud,          color: "bg-blue-100 text-blue-700" },
  google_drive: { icon: HardDrive,      color: "bg-yellow-100 text-yellow-700" },
  confluence:   { icon: BookOpen,       color: "bg-indigo-100 text-indigo-700" },
  manual:       { icon: FileText,       color: "bg-slate-100 text-slate-600" },
};

export function ConnectorLogo({ id, size = "md" }: { id: SourceType; size?: "sm" | "md" }) {
  const { icon: Icon, color } = LOGOS[id];
  const box = size === "sm" ? "h-7 w-7" : "h-10 w-10";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${box} ${color}`}>
      <Icon className={glyph} />
    </span>
  );
}
