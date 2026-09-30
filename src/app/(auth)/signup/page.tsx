import { AuthForm } from "../auth-form";

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Créer un compte</h1>
      <p className="mb-6 text-sm text-slate-500">
        Tu pourras ensuite connecter tes outils (mails, Teams, Drive…).
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
