import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import {
  getActivePlan,
  getSuggestedDay,
  getWeekSummary,
  listTeamForStudent,
} from "@/lib/data/repo";
import { ROLE_LABEL } from "@/lib/types";
import { Ledger, LedgerRow, Rings, Wave } from "@/components/ui";

export default async function HojePage() {
  const session = await requireRole("student");
  const me = session.profile.id;

  const [plan, suggested, week, team] = await Promise.all([
    getActivePlan(session, me),
    getSuggestedDay(session, me),
    getWeekSummary(session, me),
    listTeamForStudent(session, me),
  ]);

  const firstName = session.profile.fullName.split(" ")[0];
  const hoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const detail = plan?.days.find((d) => d.day.id === suggested?.id);
  const minutes = detail
    ? Math.round(
        detail.items.reduce(
          (sum, i) => sum + i.prescription.sets * (i.prescription.restSeconds + 45),
          0,
        ) / 60,
      )
    : null;

  return (
    <div className="flex flex-col gap-7 md:max-w-[560px]">
      <header>
        <p className="tag">{hoje}</p>
        <h1 className="display display-xl mt-2 text-[46px] leading-[0.88] text-ink">
          OLÁ,
          <br />
          {firstName.toUpperCase()}
        </h1>
      </header>

      {detail ? (
        <section className="molten-hero overflow-hidden rounded-[30px] pt-6">
          <div className="flex items-start justify-between gap-4 px-6">
            <div>
              <p className="font-mono text-[10.5px] tracking-[0.16em] uppercase text-gold-ink/60">
                Treino de hoje · dia {detail.day.label}
              </p>
              <p className="display display-xl mt-1.5 flex items-baseline gap-2 text-[74px] leading-[0.82]">
                {String(detail.items.length).padStart(2, "0")}
                <span className="font-sans text-[19px] font-semibold tracking-[-0.01em]">
                  exercícios
                </span>
              </p>
            </div>
            {minutes && (
              <span className="shrink-0 rounded-[var(--radius-pill)] bg-gold-ink/15 px-3 py-1.5 font-mono text-[11px] whitespace-nowrap">
                ≈ {minutes} min
              </span>
            )}
          </div>

          <p className="mt-2.5 max-w-[24ch] px-6 text-[14.5px] font-medium text-gold-ink/75">
            {detail.day.name}. {detail.items[0]?.exercise.name} abre,{" "}
            {detail.items.at(-1)?.exercise.name.toLowerCase()} fecha.
          </p>

          <Link
            href="/treino"
            className="mt-4 mb-1 flex items-center justify-between gap-2 px-6 text-[15px] font-bold"
          >
            Ver o treino
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 5 7 7-7 7" />
            </svg>
          </Link>

          <Wave />
        </section>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-edge-soft bg-metal p-6">
          <h2 className="display text-[20px] text-ink">Sem plano ativo</h2>
          <p className="mt-1.5 text-[15px] text-ink-3">
            Seu personal ainda não montou um plano de treino.
          </p>
        </section>
      )}

      {week.sessions === 0 && week.sets === 0 ? (
        <section className="border-t border-edge-soft pt-4">
          <p className="tag">Sua semana</p>
          <p className="mt-2 text-[15px] leading-snug text-ink-2">
            Ainda em branco. O primeiro treino registrado começa a preencher os
            anéis de frequência, séries e carga.
          </p>
        </section>
      ) : (
      <section className="flex items-center gap-4">
        <Rings
          train={week.sessions / week.targetSessions}
          load={week.targetSets ? week.sets / week.targetSets : 0}
          meal={week.volumeKg ? Math.min(1, week.volumeKg / 10000) : 0}
        />
        <dl className="flex flex-col gap-2.5">
          <Stat color="var(--color-ring-train)" value={`${week.sessions}`} unit={`de ${week.targetSessions} treinos`} />
          <Stat color="var(--color-ring-load)" value={`${week.sets}`} unit="séries concluídas" />
          <Stat
            color="var(--color-ring-meal)"
            value={week.volumeKg >= 1000 ? `${(week.volumeKg / 1000).toFixed(1)}t` : `${Math.round(week.volumeKg)}`}
            unit="carga movida"
          />
        </dl>
      </section>
      )}

      <section>
        <h2 className="tag mb-1">Sua equipe</h2>
        {team.length === 0 ? (
          <p className="border-t border-edge-soft py-4 text-[15px] text-ink-3">
            Nenhum profissional designado a você ainda.
          </p>
        ) : (
          <Ledger>
            {team.map(({ staff, role }) => (
              <LedgerRow
                key={`${staff.id}-${role}`}
                name={staff.fullName}
                meta={ROLE_LABEL[role].toLowerCase()}
                tail="→"
              />
            ))}
          </Ledger>
        )}
      </section>
    </div>
  );
}

function Stat({ color, value, unit }: { color: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span
        aria-hidden
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: color }}
      />
      <dt className="sr-only">{unit}</dt>
      <dd className="flex items-baseline gap-2">
        <span className="display text-[22px] leading-none text-ink">{value}</span>
        <span className="text-[13.5px] text-ink-2">{unit}</span>
      </dd>
    </div>
  );
}
