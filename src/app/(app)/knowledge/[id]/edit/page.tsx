import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentEmployee } from "@/lib/supabase/server";
import { fetchInfos, fetchReferenceData } from "@/lib/data";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { InfoForm } from "../../info-form";
import { DeleteInfoButton } from "../../delete-info-button";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditInfoPage(props: PageProps<"/knowledge/[id]/edit">) {
  const { id } = await props.params;
  if (!UUID_RE.test(id)) notFound();

  const { supabase, employee } = await getCurrentEmployee();
  const [infos, { clients, contexts }] = await Promise.all([fetchInfos(supabase), fetchReferenceData(supabase)]);
  const info = infos.find((i) => i.id === id);
  if (!info) notFound();

  const isMine = !!employee && info.employee_id === employee.id;

  return (
    <div className="max-w-2xl">
      <Link href="/knowledge" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Documents
      </Link>
      <PageHeader title="Modifier l'info" subtitle={info.title}>
        {isMine && <DeleteInfoButton infoId={info.id} title={info.title} />}
      </PageHeader>
      {isMine ? (
        <Card>
          <InfoForm clients={clients} contexts={contexts} info={info} />
        </Card>
      ) : (
        <EmptyState>Seul l&apos;auteur de cette info peut la modifier ou la supprimer.</EmptyState>
      )}
    </div>
  );
}
