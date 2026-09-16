import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export default async function EntrarPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.profile.role));

  return (
    <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6">
      <header className="pt-14 pb-10">
        <p className="tag text-gold">Studio Guerra</p>
        <h1 className="display display-xl mt-3 text-[62px] leading-[0.86] text-ink">
          BOM
          <br />
          TREINO.
        </h1>
        <p className="mt-4 max-w-[26ch] text-[16px] leading-snug text-ink-2">
          Entra que o plano de hoje já está montado.
        </p>
      </header>

      <LoginForm />

      <footer className="mt-auto pt-10 pb-4">
        <p className="font-mono text-[11px] tracking-[0.14em] text-ink-4">FITG · 2026</p>
      </footer>
    </main>
  );
}
