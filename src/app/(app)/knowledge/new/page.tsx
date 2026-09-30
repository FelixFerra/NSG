import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchReferenceData } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { InfoForm } from "./info-form";

export default async function NewInfoPage() {
  const { supabase } = await getCurrentEmployee();
  const { clients, contexts } = await fetchReferenceData(supabase);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Ajouter une info"
        subtitle="Si elle contredit une info existante, son auteur reçoit une demande de validation."
      />
      <Card>
        <InfoForm clients={clients} contexts={contexts} />
      </Card>
    </div>
  );
}
