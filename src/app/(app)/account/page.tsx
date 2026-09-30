import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ProfileForm } from "./profile-form";

export default async function AccountPage() {
  const { employee } = await getCurrentEmployee();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Mon profil" subtitle="Ces informations sont visibles par tes collègues.">
        {employee && (
          <Link href={`/team/${employee.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
            Voir mon profil public <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </PageHeader>
      {employee ? (
        <Card>
          <ProfileForm employee={employee} />
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Ton score d&apos;expertise ne se modifie pas ici : il augmente quand tu tranches un conflit ou réponds à une
            question sur un sujet.
          </p>
        </Card>
      ) : (
        <EmptyState>Aucune fiche employé liée à ce compte.</EmptyState>
      )}
    </div>
  );
}
