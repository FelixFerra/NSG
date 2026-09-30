import { redirect } from "next/navigation";
import { ShieldCheck, LogOut } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, employee } = await getCurrentEmployee();
  if (!user) redirect("/login");

  const name = employee?.full_name ?? user.email ?? "";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-white md:w-60 md:border-r md:border-b-0">
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
      <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
