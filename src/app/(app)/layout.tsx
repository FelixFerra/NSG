import { redirect } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { NotificationCenter } from "@/components/notification-center";
import { logout } from "../(auth)/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, employee } = await getCurrentEmployee();
  if (!user) redirect("/login");

  // RLS : seules les notifications de l'utilisateur sont renvoyées
  const { data: notifications } = await supabase
    .from("notifications")
    .select("*, sender:employees!notifications_sender_id_fkey(full_name), conflict:conflicts(id, status)")
    .order("read_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(20);

  const name = employee?.full_name ?? user.email ?? "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-5 py-5">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          <span className="font-semibold">NSG Trust</span>
        </div>
        <NavLinks />
        <div className="mt-auto hidden border-t border-slate-200 p-4 md:block">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-slate-500">{employee?.job_title ?? user.email}</p>
          <form action={logout} className="mt-3">
            <button className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900">
              <LogOut className="h-3.5 w-3.5" /> Se déconnecter
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 px-4 pt-4 md:px-10">
          <NotificationCenter items={notifications ?? []} />
          <form action={logout} className="md:hidden">
            <button aria-label="Se déconnecter" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </header>
        <main className="flex-1 px-4 py-4 md:px-10 md:py-6">{children}</main>
      </div>
    </div>
  );
}
