import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchReferenceData } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const { supabase } = await getCurrentEmployee();
  const { employees } = await fetchReferenceData(supabase);

  return (
    <div className="max-w-2xl">
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>
      <PageHeader title="Nouveau client" subtitle="Tu pourras ensuite ajouter ses problèmes en cours depuis sa fiche." />
      <Card>
        <ClientForm employees={employees} />
      </Card>
    </div>
  );
}
