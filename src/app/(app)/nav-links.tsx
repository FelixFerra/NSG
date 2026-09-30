"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plug, BookOpenCheck, Building2, Users, Search, Scale, Inbox } from "lucide-react";

const LINKS = [
  { href: "/search", label: "Rechercher", icon: Search },
  { href: "/inbox", label: "Boîte de réception", icon: Inbox },
  { href: "/knowledge", label: "Documents", icon: BookOpenCheck },
  { href: "/conflicts", label: "Conflits", icon: Scale },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/team", label: "Collaborateurs", icon: Users },
  { href: "/sources", label: "Sources connectées", icon: Plug },
];

export function NavLinks({ inboxCount }: { inboxCount: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm ${
              active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {href === "/inbox" && inboxCount > 0 && (
              <span className="ml-auto rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{inboxCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
