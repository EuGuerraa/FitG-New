import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, homeFor } from "@/lib/auth/session";
import {
  ForbiddenError,
  NotFoundError,
  getActivePlan,
  getStudent,
  listRecentSessions,
  listTeamForStudent,
} from "@/lib/data/repo";
import { ROLE_LABEL } from "@/lib/types";
import { Ledger, LedgerRow } from "@/components/ui";

export default async function AlunoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const back = homeFor(session.profile.role);

  let student;
  try {
    student = await getStudent(session, id);
  } catch (error) {
    if (error instanceof ForbiddenError) return <Negado backHref={back} />;
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const podeMontar =
    session.profile.role === "owner" || session.profile.role === "trainer";

  const [team, plan, recent] = await Promise.all([
    listTeamForStudent(session, student.id),
    getActivePlan(session, student.id),
    listRecentSessions(session, student.id, 5),
  ]);

  return (
    <div className="flex flex-col gap-7 md:max-w-[560px]">
      <Link href={back} className="tag transition hover:text-ink-2">
        ← Voltar
      </Link>

      <header className="flex items-center gap-4">
        <span className="display grid h-16 w-16 shrink-0 place-items-center rounded-[18px] border border-edge-soft bg-metal-2 text-[24px] text-ink-2">
          {student.fullName.charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="display truncate text-[30px] leading-none text-ink">
            {student.fullName}
          </h1>
          <p className="mt-1.5 truncate font-mono text-[11.5px] text-ink-3">
            {student.email}
          </p>
        </div>
      </header>

      <section>
        <h2 className="tag">Equipe</h2>
        <Ledger>
          {team.map(({ staff, role }) => (
            <LedgerRow
              key={`${staff.id}-${role}`}
              name={staff.fullName}
              meta={ROLE_LABEL[role].toLowerCase()}
            />
          ))}
        </Ledger>
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="tag">Plano de treino</h2>
          {podeMontar && (
            <Link
              href={`/alunos/${student.id}/plano`}
              className="font-mono text-[11px] text-gold transition hover:text-gold-hot"
            >
              {plan ? "editar plano" : "montar plano"} →
            </Link>
          )}
        </div>
        {plan ? (
          <Ledger>
            {plan.days.map((detail) => (
              <LedgerRow
                key={detail.day.id}
                glyph={detail.day.label}
                name={detail.day.name}
                meta={`${detail.items.length} exercícios · ${detail.items.reduce(
                  (s, i) => s + i.prescription.sets,
                  0,
                )} séries`}
              />
            ))}
          </Ledger>
        ) : (
          <p className="border-t border-edge-soft py-5 text-[15px] text-ink-3">
            Nenhum plano ativo.
          </p>
        )}
      </section>

      <section>
        <h2 className="tag">Últimos treinos</h2>
        {recent.length > 0 ? (
          <Ledger>
            {recent.map((s) => {
              const day = plan?.days.find((d) => d.day.id === s.dayId)?.day;
              return (
                <LedgerRow
                  key={s.id}
                  name={day ? `${day.label} · ${day.name}` : "Treino"}
                  meta={new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(s.startedAt))}
                  tail={
                    s.perceivedEffort ? `esforço ${s.perceivedEffort}/10` : undefined
                  }
                />
              );
            })}
          </Ledger>
        ) : (
          <p className="border-t border-edge-soft py-5 text-[15px] text-ink-3">
            Ainda sem treino registrado.
          </p>
        )}
      </section>
    </div>
  );
}

function Negado({ backHref }: { backHref: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-edge-soft bg-metal p-8 text-center">
      <h1 className="display text-[24px] text-ink">Acesso negado</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-snug text-ink-3">
        Este aluno não está designado a você. Quem decide isso é o banco, não a tela —
        a mesma regra vale na API e no Postgres.
      </p>
      <Link
        href={backHref}
        className="mt-5 inline-flex h-12 items-center rounded-[var(--radius-pill)] border border-edge px-5 text-[15px] text-ink transition hover:bg-metal-2"
      >
        Voltar
      </Link>
    </div>
  );
}
