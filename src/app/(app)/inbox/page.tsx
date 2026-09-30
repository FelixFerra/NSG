import { CheckCircle2, Inbox } from "lucide-react";

/** Panneau de droite quand rien n'est sélectionné (grand écran). */
export default async function InboxPage(props: PageProps<"/inbox">) {
  const searchParams = await props.searchParams;
  const done = searchParams.done === "1";

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${done ? "bg-emerald-50" : "bg-slate-100"}`}>
        {done ? <CheckCircle2 className="h-7 w-7 text-emerald-600" /> : <Inbox className="h-7 w-7 text-slate-400" />}
      </span>
      <p className="mt-4 font-medium text-slate-800">{done ? "Réponse envoyée" : "Aucun élément sélectionné"}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        {done ? "Ton collègue a été notifié. Passe à l'élément suivant." : "Choisis une validation ou une question dans la liste pour la traiter ici."}
      </p>
    </div>
  );
}
