import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listStudentsWithActivity } from "@/lib/data/repo";
import { Roster } from "@/components/Roster";

export default async function NutriPage() {
  const session = await requireRole("nutritionist");
  const entries = await listStudentsWithActivity(session);

  return (
    <div className="flex flex-col gap-7 md:max-w-[620px]">
      <header>
        <p className="tag text-gold">{session.tenant.name} · nutricionista</p>
        <h1 className="display display-xl mt-2 text-[46px] leading-[0.88] text-ink">
          SEUS
          <br />
          ALUNOS
        </h1>
      </header>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="tag">Acompanhamento nutricional</h2>
          <Link
            href="/convites"
            className="font-mono text-[11px] text-gold transition hover:text-gold-hot"
          >
            convidar aluno →
          </Link>
        </div>
        <div className="mt-1.5">
          <Roster entries={entries} empty="Nenhum aluno designado a você ainda." />
        </div>
      </section>

      <p className="text-[13.5px] leading-snug text-ink-4">
        Planos alimentares e registro de refeições entram na próxima etapa. Por
        enquanto, a frequência de treino já dá o contexto do acompanhamento.
      </p>
    </div>
  );
}
