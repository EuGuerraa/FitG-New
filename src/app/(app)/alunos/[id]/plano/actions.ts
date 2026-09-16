"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  addDay,
  addExerciseToDay,
  createPlan,
  moveDayExercise,
  removeDay,
  removeDayExercise,
  updateDay,
  updateDayExercise,
  updatePlan,
} from "@/lib/data/repo";

// O repositório recusa nutricionista e aluno; aqui só traduzimos o formulário.
// Nenhuma action confia em tenant ou papel vindos do cliente.

const num = (form: FormData, field: string): number | undefined => {
  const raw = String(form.get(field) ?? "").replace(",", ".").trim();
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
};

function back(studentId: string, dayId?: string | null): never {
  revalidatePath(`/alunos/${studentId}/plano`);
  revalidatePath(`/alunos/${studentId}`);
  redirect(`/alunos/${studentId}/plano${dayId ? `?dia=${dayId}` : ""}`);
}

export async function criarPlano(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "Plano de treino";
  const goal = String(formData.get("goal") ?? "").trim() || null;

  await createPlan(session, studentId, { name, goal });
  back(studentId);
}

export async function renomearPlano(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const planId = String(formData.get("planId") ?? "");

  await updatePlan(session, planId, {
    name: String(formData.get("name") ?? "").trim() || "Plano de treino",
    goal: String(formData.get("goal") ?? "").trim() || null,
  });
  back(studentId, String(formData.get("dayId") ?? "") || null);
}

export async function adicionarDia(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const name = String(formData.get("name") ?? "").trim() || "Novo dia";

  const day = await addDay(session, planId, { name });
  back(studentId, day.id);
}

export async function renomearDia(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const dayId = String(formData.get("dayId") ?? "");

  await updateDay(session, dayId, {
    name: String(formData.get("name") ?? "").trim() || "Dia sem nome",
    focus: String(formData.get("focus") ?? "").trim() || null,
  });
  back(studentId, dayId);
}

export async function removerDia(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  await removeDay(session, String(formData.get("dayId") ?? ""));
  back(studentId);
}

export async function adicionarExercicio(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const dayId = String(formData.get("dayId") ?? "");

  await addExerciseToDay(session, dayId, String(formData.get("exerciseId") ?? ""));
  back(studentId, dayId);
}

export async function salvarPrescricao(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const dayId = String(formData.get("dayId") ?? "");
  const id = String(formData.get("dayExerciseId") ?? "");

  const load = num(formData, "targetLoadKg");
  await updateDayExercise(session, id, {
    sets: num(formData, "sets"),
    restSeconds: num(formData, "restSeconds"),
    targetReps: String(formData.get("targetReps") ?? "").trim() || "10",
    targetLoadKg: load ?? null,
  });
  back(studentId, dayId);
}

export async function removerExercicio(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const dayId = String(formData.get("dayId") ?? "");
  await removeDayExercise(session, String(formData.get("dayExerciseId") ?? ""));
  back(studentId, dayId);
}

export async function moverExercicio(formData: FormData): Promise<void> {
  const session = await requireSession();
  const studentId = String(formData.get("studentId") ?? "");
  const dayId = String(formData.get("dayId") ?? "");
  const direction = String(formData.get("direction") ?? "up") === "down" ? "down" : "up";

  await moveDayExercise(session, String(formData.get("dayExerciseId") ?? ""), direction);
  back(studentId, dayId);
}
