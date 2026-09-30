import { AuthForm } from "../auth-form";

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Connexion</h1>
      <p className="mb-6 text-sm text-slate-500">Accède à la base de savoir de ton entreprise.</p>
      <AuthForm mode="login" />
    </>
  );
}
