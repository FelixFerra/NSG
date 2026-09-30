import { CheckCircle2, MousePointerClick } from "lucide-react";

/** Panneau de droite quand rien n'est sélectionné (visible sur grand écran). */
export default async function InboxPage(props: PageProps<"/inbox">) {
  const searchParams = await props.searchParams;

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      {searchParams.done === "1" ? (
        <>
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="mt-3 font-medium">Réponse envoyée</p>
          <p className="mt-1 text-sm text-slate-500">Ton collègue a été notifié. Choisis l&apos;élément suivant à gauche.</p>
        </>
      ) : (
        <>
          <MousePointerClick className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">Sélectionne un élément</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Demandes de validation, questions de tes collègues et réponses reçues : ouvre-les pour les traiter
            directement ici.
          </p>
        </>
      )}
    </div>
  );
}
