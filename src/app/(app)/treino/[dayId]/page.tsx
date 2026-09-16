import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  ForbiddenError,
  NotFoundError,
  getActiveSession,
  getDay,
  getLastLogsByDayExercise,
  getSessionLogs,
} from "@/lib/data/repo";
import { WorkoutRunner } from "@/components/workout/WorkoutRunner";
import { BTN } from "@/components/ui";
import { iniciarTreino } from "../actions";

export default async function ExecucaoPage({
  params,
}: {
  params: Promise<{ dayId: string }>;
}) {
  const { dayId } = await params;
  const session = await requireRole("student");

  let day;
  try {
    ({ detail: day } = await getDay(session, dayId));
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ForbiddenError) notFound();
    throw error;
  }

  const active = await getActiveSession(session);
  const running = active && active.dayId === dayId ? active : null;

  if (!running) {
    return (
      <div className="flex flex-col gap-6 md:max-w-[430px]">
        <header>
          <p className="tag text-gold">Dia {day.day.label}</p>
          <h1 className="display display-xl mt-2 text-[46px] leading-[0.88] text-ink">
            {day.day.name.toUpperCase()}
          </h1>
          <p className="mt-2.5 font-mono text-[11.5px] text-ink-3">
            {day.items.length} exercícios ·{" "}
            {day.items.reduce((s, i) => s + i.prescription.sets, 0)} séries
          </p>
        </header>

        <form action={iniciarTreino}>
          <input type="hidden" name="dayId" value={dayId} />
          <button type="submit" className={BTN}>
            Começar agora
          </button>
        </form>

        <Link href="/treino" className="tag transition hover:text-ink-2">
          ← Voltar ao plano
        </Link>
      </div>
    );
  }

  const [logs, previous] = await Promise.all([
    getSessionLogs(session, running.id),
    getLastLogsByDayExercise(session, session.profile.id, dayId),
  ]);

  return (
    <WorkoutRunner
      tenantId={session.tenant.id}
      workoutSessionId={running.id}
      startedAt={running.startedAt}
      day={day.day}
      items={day.items.map(({ prescription, exercise }) => ({
        id: prescription.id,
        exerciseId: exercise.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        sets: prescription.sets,
        targetReps: prescription.targetReps,
        targetLoadKg: prescription.targetLoadKg,
        restSeconds: prescription.restSeconds,
        notes: prescription.notes,
        previous: (previous[prescription.id] ?? []).map((l) => ({
          setIndex: l.setIndex,
          reps: l.reps,
          loadKg: l.loadKg,
        })),
      }))}
      logged={logs.map((l) => ({
        dayExerciseId: l.dayExerciseId ?? "",
        setIndex: l.setIndex,
        reps: l.reps,
        loadKg: l.loadKg,
      }))}
    />
  );
}
