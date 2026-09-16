import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  ForbiddenError,
  NotFoundError,
  getActivePlan,
  getStudent,
  listExercises,
} from "@/lib/data/repo";
import { BTN, FIELD } from "@/components/ui";
import { ExercisePicker } from "./ExercisePicker";
import {
  adicionarDia,
  criarPlano,
  moverExercicio,
  removerDia,
  removerExercicio,
  renomearDia,
  renomearPlano,
  salvarPrescricao,
} from "./actions";

export default async function PlanoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { id } = await params;
  const { dia } = await searchParams;
  const session = await requireSession();

  // Nutricionista e aluno leem o plano na ficha; montar é do personal.
  if (session.profile.role === "student" || session.profile.role === "nutritionist") {
    redirect(`/alunos/${id}`);
  }

  let student;
  try {
    student = await getStudent(session, id);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }

  const [planDetail, exercises] = await Promise.all([
    getActivePlan(session, id),
    listExercises(session),
  ]);

  if (!planDetail) {
    return (
      <div className="flex flex-col gap-6 md:max-w-[480px]">
        <Voltar href={`/alunos/${id}`} />
        <header>
          <p className="tag text-gold">{student.fullName}</p>
          <h1 className="display display-xl mt-2 text-[42px] leading-[0.88] text-ink">
            NOVO
            <br />
            PLANO
          </h1>
        </header>

        <form action={criarPlano} className="flex flex-col gap-3">
          <input type="hidden" name="studentId" value={id} />
          <Campo name="name" label="Nome do plano" placeholder="Hipertrofia — 3x por semana" />
          <Campo name="goal" label="Objetivo" placeholder="Ganho de massa magra" />
          <button type="submit" className={`${BTN} mt-1.5`}>
            Criar plano
          </button>
        </form>

        <p className="text-[13.5px] leading-snug text-ink-4">
          O plano nasce vazio e ativo. Criar um novo depois arquiva este — o histórico de
          treinos executados continua intacto.
        </p>
      </div>
    );
  }

  const { plan, days } = planDetail;
  const active = days.find((d) => d.day.id === dia) ?? days[0] ?? null;

  return (
    <div className="flex flex-col gap-7 md:max-w-[620px]">
      <Voltar href={`/alunos/${id}`} />

      <header>
        <p className="tag text-gold">{student.fullName}</p>
        <h1 className="display display-xl mt-2 text-[42px] leading-[0.88] text-ink">
          {plan.name.toUpperCase()}
        </h1>
      </header>

      <details className="border-t border-edge-soft pt-4">
        <summary className="tag cursor-pointer list-none transition hover:text-ink-2">
          Editar nome e objetivo ▾
        </summary>
        <form action={renomearPlano} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="studentId" value={id} />
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="dayId" value={active?.day.id ?? ""} />
          <Campo name="name" label="Nome do plano" defaultValue={plan.name} />
          <Campo name="goal" label="Objetivo" defaultValue={plan.goal ?? ""} />
          <button type="submit" className="h-11 w-fit rounded-[var(--radius-pill)] border border-edge px-5 text-[14px] font-semibold text-ink transition hover:bg-metal">
            Salvar
          </button>
        </form>
      </details>

      <section>
        <h2 className="tag">Dias do plano</h2>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {days.map((detail) => {
            const on = detail.day.id === active?.day.id;
            return (
              <Link
                key={detail.day.id}
                href={`/alunos/${id}/plano?dia=${detail.day.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border px-4 transition ${
                  on
                    ? "border-gold/55 bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-gold)_16%,transparent),color-mix(in_srgb,var(--color-gold)_5%,transparent))]"
                    : "border-edge-soft hover:border-edge"
                }`}
              >
                <span className={`display text-[19px] leading-none ${on ? "text-gold" : "text-ink-3"}`}>
                  {detail.day.label}
                </span>
                <span className={`text-[14px] font-medium ${on ? "text-ink" : "text-ink-3"}`}>
                  {detail.day.name}
                </span>
              </Link>
            );
          })}

          <form action={adicionarDia}>
            <input type="hidden" name="studentId" value={id} />
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="name" value="Novo dia" />
            <button
              type="submit"
              className="h-11 rounded-[var(--radius-pill)] border border-dashed border-edge px-4 font-mono text-[12px] text-ink-3 transition hover:border-gold hover:text-gold"
            >
              + dia
            </button>
          </form>
        </div>
      </section>

      {active ? (
        <>
          <section className="border-t border-edge-soft pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-[26px] text-ink">
                <span className="text-gold">{active.day.label}</span> · {active.day.name}
              </h2>
              <span className="shrink-0 font-mono text-[11px] text-ink-4">
                {active.items.reduce((s, i) => s + i.prescription.sets, 0)} séries
              </span>
            </div>

            <details className="mt-3">
              <summary className="tag cursor-pointer list-none transition hover:text-ink-2">
                Renomear ou remover este dia ▾
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <form action={renomearDia} className="flex flex-col gap-3">
                  <input type="hidden" name="studentId" value={id} />
                  <input type="hidden" name="dayId" value={active.day.id} />
                  <Campo name="name" label="Nome do dia" defaultValue={active.day.name} />
                  <Campo name="focus" label="Foco" defaultValue={active.day.focus ?? ""} />
                  <button type="submit" className="h-11 w-fit rounded-[var(--radius-pill)] border border-edge px-5 text-[14px] font-semibold text-ink transition hover:bg-metal">
                    Salvar
                  </button>
                </form>
                <form action={removerDia}>
                  <input type="hidden" name="studentId" value={id} />
                  <input type="hidden" name="dayId" value={active.day.id} />
                  <button
                    type="submit"
                    className="h-11 rounded-[var(--radius-pill)] border border-danger/40 px-5 text-[14px] font-semibold text-danger transition hover:bg-danger/10"
                  >
                    Remover dia {active.day.label}
                  </button>
                </form>
                <p className="text-[13px] leading-snug text-ink-4">
                  Remover o dia apaga a prescrição, não o histórico: treinos já executados
                  continuam registrados.
                </p>
              </div>
            </details>
          </section>

          <section className="flex flex-col">
            {active.items.length === 0 && (
              <p className="border-t border-edge-soft py-5 text-[15px] text-ink-3">
                Dia vazio. Busque um exercício abaixo para começar.
              </p>
            )}

            {active.items.map(({ prescription, exercise }, index) => (
              <article
                key={prescription.id}
                className="border-t border-edge-soft py-4 last:border-b"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-[16px] font-semibold tracking-[-0.005em] text-ink">
                    <span className="mr-2 font-mono text-[11px] text-ink-4">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {exercise.name}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1">
                    <Mover
                      studentId={id}
                      dayId={active.day.id}
                      dayExerciseId={prescription.id}
                      direction="up"
                      disabled={index === 0}
                    />
                    <Mover
                      studentId={id}
                      dayId={active.day.id}
                      dayExerciseId={prescription.id}
                      direction="down"
                      disabled={index === active.items.length - 1}
                    />
                    <form action={removerExercicio}>
                      <input type="hidden" name="studentId" value={id} />
                      <input type="hidden" name="dayId" value={active.day.id} />
                      <input type="hidden" name="dayExerciseId" value={prescription.id} />
                      <button
                        type="submit"
                        aria-label={`Remover ${exercise.name}`}
                        className="grid h-8 w-8 place-items-center rounded-[10px] border border-edge-soft text-ink-4 transition hover:border-danger/50 hover:text-danger"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </form>
                  </div>
                </div>

                <form
                  action={salvarPrescricao}
                  className="mt-3 grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2"
                >
                  <input type="hidden" name="studentId" value={id} />
                  <input type="hidden" name="dayId" value={active.day.id} />
                  <input type="hidden" name="dayExerciseId" value={prescription.id} />

                  <Mini name="sets" label="séries" defaultValue={String(prescription.sets)} />
                  <Mini name="targetReps" label="reps" defaultValue={prescription.targetReps} />
                  <Mini
                    name="targetLoadKg"
                    label="kg"
                    defaultValue={
                      prescription.targetLoadKg === null
                        ? ""
                        : String(prescription.targetLoadKg).replace(".", ",")
                    }
                  />
                  <Mini
                    name="restSeconds"
                    label="desc. (s)"
                    defaultValue={String(prescription.restSeconds)}
                  />
                  <button
                    type="submit"
                    className="h-10 rounded-[var(--radius-pill)] border border-edge px-4 font-mono text-[11.5px] text-ink-2 transition hover:border-gold hover:text-gold"
                  >
                    salvar
                  </button>
                </form>
              </article>
            ))}
          </section>

          <section className="border-t border-edge-soft pt-5">
            <ExercisePicker
              exercises={exercises.map((e) => ({
                id: e.id,
                name: e.name,
                muscleGroup: e.muscleGroup,
                equipment: e.equipment,
              }))}
              studentId={id}
              dayId={active.day.id}
            />
          </section>
        </>
      ) : (
        <p className="border-t border-edge-soft py-5 text-[15px] text-ink-3">
          Plano sem dias. Use “+ dia” para criar o primeiro.
        </p>
      )}
    </div>
  );
}

function Voltar({ href }: { href: string }) {
  return (
    <Link href={href} className="tag transition hover:text-ink-2">
      ← Voltar para a ficha
    </Link>
  );
}

function Campo({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] text-ink-3">{label}</span>
      <input
        id={`campo-${name}`}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={FIELD}
      />
    </label>
  );
}

function Mini({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block font-mono text-[10px] tracking-[0.08em] text-ink-4">
        {label}
      </span>
      <input
        id={`mini-${name}`}
        name={name}
        defaultValue={defaultValue}
        inputMode="text"
        className="tnum h-10 w-full min-w-0 rounded-[11px] border border-edge-soft bg-metal px-2.5 text-center font-mono text-[13px] text-ink outline-none focus:border-gold"
      />
    </label>
  );
}

function Mover({
  studentId,
  dayId,
  dayExerciseId,
  direction,
  disabled,
}: {
  studentId: string;
  dayId: string;
  dayExerciseId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moverExercicio}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="dayId" value={dayId} />
      <input type="hidden" name="dayExerciseId" value={dayExerciseId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={direction === "up" ? "Subir exercício" : "Descer exercício"}
        className="grid h-8 w-8 place-items-center rounded-[10px] border border-edge-soft text-ink-3 transition hover:border-edge hover:text-ink disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={direction === "up" ? "m5 15 7-7 7 7" : "m5 9 7 7 7-7"} />
        </svg>
      </button>
    </form>
  );
}
