import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import {
  getActivePlan,
  getActiveSession,
  getSuggestedDay,
  listRecentSessions,
} from "@/lib/data/repo";
import { BTN, Empty, Ledger, LedgerRow } from "@/components/ui";
import { iniciarTreino } from "./actions";

export default async function TreinoPage({
  searchParams,
}: {
  searchParams: Promise<{ concluido?: string }>;
}) {
  const session = await requireRole("student");
  const me = session.profile.id;
  const { concluido } = await searchParams;

  const [planDetail, active, recent, suggested] = await Promise.all([
    getActivePlan(session, me),
    getActiveSession(session),
    listRecentSessions(session, me, 5),
    getSuggestedDay(session, me),
  ]);

  if (!planDetail) {
    return (
      <Empty
        title="Sem plano ativo"
        hint="Seu personal ainda não montou um plano de treino para você."
      />
    );
  }

  const { plan, days } = planDetail;
  const doneByDay = new Map<string, number>();
  const lastByDay = new Map<string, string>();
  for (const s of recent) {
    if (!s.dayId) continue;
    doneByDay.set(s.dayId, (doneByDay.get(s.dayId) ?? 0) + 1);
    if (!lastByDay.has(s.dayId)) lastByDay.set(s.dayId, s.startedAt);
  }

  const target = active?.dayId ?? suggested?.id ?? days[0]?.day.id;
  const targetDay = days.find((d) => d.day.id === target);

  return (
    <div className="flex flex-col gap-7 md:max-w-[560px]">
      {concluido && (
        <p className="rounded-[var(--radius-tile)] border border-positive/40 px-4 py-3 text-[15px] text-positive">
          Treino registrado. Bom trabalho.
        </p>
      )}

      <header>
        <p className="tag text-gold">
          Plano ativo · desde{" "}
          {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(
            new Date(plan.startsOn),
          )}
        </p>
        <h1 className="display display-xl mt-2 text-[46px] leading-[0.88] text-ink">
          {plan.name.toUpperCase()}
        </h1>
        {plan.goal && (
          <p className="mt-2.5 font-mono text-[11.5px] text-ink-3">
            {days.length}× por semana · {plan.goal.toLowerCase()}
          </p>
        )}
      </header>

      <section>
        <Ledger>
          {days.map((detail) => {
            const total = detail.items.reduce((sum, i) => sum + i.prescription.sets, 0);
            const vezes = doneByDay.get(detail.day.id) ?? 0;
            const last = lastByDay.get(detail.day.id);
            const hot = detail.day.id === target;
            return (
              <LedgerRow
                key={detail.day.id}
                glyph={detail.day.label}
                hot={hot}
                name={detail.day.name}
                meta={`${detail.items.length} exercícios · ${total} séries`}
                tail={
                  hot ? (
                    active?.dayId === detail.day.id ? "em andamento" : "hoje"
                  ) : (
                    <>
                      {vezes > 0 ? `feito ${vezes}×` : "ainda não"}
                      {last && (
                        <>
                          <br />
                          {relativo(last)}
                        </>
                      )}
                    </>
                  )
                }
              />
            );
          })}
        </Ledger>
      </section>

      {targetDay && (
        <form action={iniciarTreino}>
          <input type="hidden" name="dayId" value={targetDay.day.id} />
          <button type="submit" className={BTN}>
            {active?.dayId === targetDay.day.id
              ? "Continuar treino"
              : `Começar dia ${targetDay.day.label}`}
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9 5 7 7-7 7" />
            </svg>
          </button>
        </form>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="tag mb-1">Últimos treinos</h2>
          <Ledger>
            {recent.map((s) => {
              const day = days.find((d) => d.day.id === s.dayId)?.day;
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
                  tail={formatDuration(s.durationSeconds)}
                />
              );
            })}
          </Ledger>
        </section>
      )}

      <Link href="/hoje" className="tag transition hover:text-ink-2">
        ← Voltar para hoje
      </Link>
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

function relativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
