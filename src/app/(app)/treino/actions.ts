"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import {
  finishWorkout,
  logSet,
  startWorkout,
  undoSet,
} from "@/lib/data/repo";

// Nenhuma destas funções confia em `studentId` vindo do cliente: o aluno é
// sempre o da sessão. O repositório recusa qualquer sessão que não seja a dele.

export async function iniciarTreino(formData: FormData): Promise<void> {
  const session = await requireRole("student");
  const dayId = String(formData.get("dayId") ?? "");
  const workout = await startWorkout(session, dayId);
  revalidatePath("/treino");
  redirect(`/treino/${workout.dayId}`);
}

export type SetInput = {
  workoutSessionId: string;
  dayExerciseId: string;
  setIndex: number;
  reps: number | null;
  loadKg: number | null;
};

export async function registrarSerie(input: SetInput): Promise<{ ok: true }> {
  const session = await requireRole("student");
  await logSet(session, input);
  return { ok: true };
}

export async function desfazerSerie(
  workoutSessionId: string,
  dayExerciseId: string,
  setIndex: number,
): Promise<{ ok: true }> {
  const session = await requireRole("student");
  await undoSet(session, workoutSessionId, dayExerciseId, setIndex);
  return { ok: true };
}

export async function encerrarTreino(
  workoutSessionId: string,
  perceivedEffort: number | null,
): Promise<void> {
  const session = await requireRole("student");
  await finishWorkout(session, workoutSessionId, { perceivedEffort });
  revalidatePath("/treino");
  revalidatePath("/hoje");
  redirect("/treino?concluido=1");
}
