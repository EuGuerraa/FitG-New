import "server-only";
import type {
  AppRole,
  Assignment,
  Invite,
  DayDetail,
  DayExercise,
  Exercise,
  PlanDetail,
  Profile,
  Session,
  SetLog,
  StaffKind,
  Tenant,
  WorkoutDay,
  WorkoutPlan,
  WorkoutSession,
} from "@/lib/types";
import { getSupabase } from "@/lib/supabase/server";

// =============================================================================
// Repositório
//
// Depois do Supabase este arquivo encolheu — e isso é o ponto. A autorização
// não é mais repetida aqui: toda consulta chega ao Postgres com o JWT do
// usuário e as políticas de RLS decidem o que ele enxerga. Uma leitura que
// voltaria "proibido" simplesmente volta vazia; uma escrita indevida é recusada
// pelo banco.
//
// Regra da casa: nenhuma consulta usa service_role. Se alguma precisasse
// contornar o RLS, o erro estaria na política, não aqui.
// =============================================================================

export class ForbiddenError extends Error {
  constructor(message = "Sem permissão para acessar este recurso") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Recurso não encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

type PgError = { code?: string; message: string } | null;

/** Códigos que o Postgres devolve quando a política recusa a escrita. */
const DENIED = new Set(["42501", "PGRST301"]);

function raise(error: PgError): void {
  if (!error) return;
  if (error.code && DENIED.has(error.code)) throw new ForbiddenError();
  throw new Error(error.message);
}

// ---------------------------------------------------------------- Mapeadores

type Row = Record<string, unknown>;

const toProfile = (r: Row): Profile => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  role: r.role as Profile["role"],
  fullName: r.full_name as string,
  email: (r.email as string) ?? "",
  avatarUrl: (r.avatar_url as string) ?? null,
  phone: (r.phone as string) ?? null,
  birthDate: (r.birth_date as string) ?? null,
  isActive: r.is_active as boolean,
  createdAt: r.created_at as string,
});

const toTenant = (r: Row): Tenant => ({
  id: r.id as string,
  slug: r.slug as string,
  name: r.name as string,
  brandColor: r.brand_color as string,
  logoUrl: (r.logo_url as string) ?? null,
  plan: r.plan as Tenant["plan"],
  createdAt: r.created_at as string,
});

const toExercise = (r: Row): Exercise => ({
  id: r.id as string,
  tenantId: (r.tenant_id as string) ?? null,
  name: r.name as string,
  muscleGroup: r.muscle_group as string,
  equipment: (r.equipment as string) ?? null,
  videoUrl: (r.video_url as string) ?? null,
  instructions: (r.instructions as string) ?? null,
});

const toPlan = (r: Row): WorkoutPlan => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  studentId: r.student_id as string,
  createdBy: (r.created_by as string) ?? null,
  name: r.name as string,
  goal: (r.goal as string) ?? null,
  notes: (r.notes as string) ?? null,
  startsOn: r.starts_on as string,
  endsOn: (r.ends_on as string) ?? null,
  isActive: r.is_active as boolean,
  createdAt: r.created_at as string,
});

const toDay = (r: Row): WorkoutDay => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  planId: r.plan_id as string,
  label: r.label as string,
  name: r.name as string,
  focus: (r.focus as string) ?? null,
  orderIndex: r.order_index as number,
});

const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const toPrescription = (r: Row): DayExercise => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  dayId: r.day_id as string,
  exerciseId: r.exercise_id as string,
  orderIndex: r.order_index as number,
  sets: r.sets as number,
  targetReps: r.target_reps as string,
  targetLoadKg: num(r.target_load_kg),
  restSeconds: r.rest_seconds as number,
  supersetGroup: (r.superset_group as string) ?? null,
  notes: (r.notes as string) ?? null,
});

const toWorkoutSession = (r: Row): WorkoutSession => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  studentId: r.student_id as string,
  planId: (r.plan_id as string) ?? null,
  dayId: (r.day_id as string) ?? null,
  status: r.status as WorkoutSession["status"],
  startedAt: r.started_at as string,
  finishedAt: (r.finished_at as string) ?? null,
  durationSeconds: (r.duration_seconds as number) ?? null,
  perceivedEffort: (r.perceived_effort as number) ?? null,
  notes: (r.notes as string) ?? null,
});

const toSetLog = (r: Row): SetLog => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  sessionId: r.session_id as string,
  dayExerciseId: (r.day_exercise_id as string) ?? null,
  exerciseId: r.exercise_id as string,
  setIndex: r.set_index as number,
  reps: (r.reps as number) ?? null,
  loadKg: num(r.load_kg),
  targetReps: (r.target_reps as string) ?? null,
  targetLoadKg: num(r.target_load_kg),
  isWarmup: r.is_warmup as boolean,
  completedAt: r.completed_at as string,
});

const PROFILE_COLS =
  "id, tenant_id, role, full_name, email, avatar_url, phone, birth_date, is_active, created_at";
const DAY_COLS = "id, tenant_id, plan_id, label, name, focus, order_index";
const PRESC_COLS =
  "id, tenant_id, day_id, exercise_id, order_index, sets, target_reps, target_load_kg, rest_seconds, superset_group, notes";
const EXERCISE_COLS =
  "id, tenant_id, name, muscle_group, equipment, video_url, instructions";

// ------------------------------------------------------------------- Perfis

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await getSupabase();
  const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", id).maybeSingle();
  return data ? toProfile(data) : null;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("tenants")
    .select("id, slug, name, brand_color, logo_url, plan, created_at")
    .eq("id", id)
    .maybeSingle();
  return data ? toTenant(data) : null;
}

/**
 * O RLS já responde isto: se o aluno aparece na consulta, é porque pode ser
 * visto. Continua existindo para as telas perguntarem antes de oferecer um botão.
 */
export async function canViewStudent(_session: Session, studentId: string): Promise<boolean> {
  const supabase = await getSupabase();
  const { data } = await supabase.from("profiles").select("id").eq("id", studentId).maybeSingle();
  return Boolean(data);
}

export async function listStudents(_session: Session): Promise<Profile[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("role", "student")
    .eq("is_active", true)
    .order("full_name");
  raise(error);
  return (data ?? []).map(toProfile);
}

export async function listTeamForStudent(
  _session: Session,
  studentId: string,
): Promise<{ staff: Profile; role: StaffKind }[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("assignments")
    .select(`staff_role, staff:profiles!assignments_staff_id_fkey(${PROFILE_COLS})`)
    .eq("student_id", studentId)
    .eq("is_active", true);
  raise(error);

  return (data ?? []).flatMap((row) => {
    const staff = row.staff as unknown as Row | null;
    return staff ? [{ staff: toProfile(staff), role: row.staff_role as StaffKind }] : [];
  });
}

export async function listStaff(session: Session): Promise<Profile[]> {
  if (session.profile.role === "student") {
    const team = await listTeamForStudent(session, session.profile.id);
    return team.map((t) => t.staff);
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .neq("role", "student")
    .eq("is_active", true)
    .order("full_name");
  raise(error);
  return (data ?? []).map(toProfile);
}

export async function getStudent(_session: Session, studentId: string): Promise<Profile> {
  const profile = await getProfileById(studentId);
  // Sem linha pode ser "não existe" ou "o RLS escondeu". De fora é a mesma
  // coisa, e assim deve ser: não vazamos nem a existência do aluno.
  if (!profile) throw new ForbiddenError();
  return profile;
}

export async function updateOwnProfile(
  session: Session,
  patch: Partial<Pick<Profile, "fullName" | "phone" | "birthDate" | "avatarUrl">>,
): Promise<Profile> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.birthDate !== undefined ? { birth_date: patch.birthDate } : {}),
      ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
    })
    .eq("id", session.profile.id)
    .select(PROFILE_COLS)
    .single();
  raise(error);
  return toProfile(data as Row);
}

export async function assignStaffToStudent(
  session: Session,
  studentId: string,
  staffId: string,
  staffRole: StaffKind,
): Promise<Assignment> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("assignments")
    .upsert(
      {
        tenant_id: session.tenant.id,
        student_id: studentId,
        staff_id: staffId,
        staff_role: staffRole,
        is_active: true,
        ended_at: null,
      },
      { onConflict: "student_id,staff_id,staff_role" },
    )
    .select()
    .single();
  raise(error);
  const row = data as Row;
  return {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    studentId: row.student_id as string,
    staffId: row.staff_id as string,
    staffRole: row.staff_role as StaffKind,
    isActive: row.is_active as boolean,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string) ?? null,
  };
}

// ------------------------------------------------------------------- Treino

function hydrateItems(rows: Row[]): DayDetail["items"] {
  return rows.flatMap((row) => {
    const exercise = row.exercise as unknown as Row | null;
    return exercise
      ? [{ prescription: toPrescription(row), exercise: toExercise(exercise) }]
      : [];
  });
}

export async function getActivePlan(
  _session: Session,
  studentId: string,
): Promise<PlanDetail | null> {
  const supabase = await getSupabase();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return null;

  const { data: days } = await supabase
    .from("workout_days")
    .select(DAY_COLS)
    .eq("plan_id", plan.id)
    .order("order_index");
  if (!days?.length) return { plan: toPlan(plan), days: [] };

  const { data: items } = await supabase
    .from("workout_day_exercises")
    .select(`${PRESC_COLS}, exercise:exercises(${EXERCISE_COLS})`)
    .in(
      "day_id",
      days.map((d) => d.id),
    )
    .order("order_index");

  return {
    plan: toPlan(plan),
    days: days.map((day) => ({
      day: toDay(day),
      items: hydrateItems(((items ?? []) as Row[]).filter((i) => i.day_id === day.id)),
    })),
  };
}

export async function getDay(
  _session: Session,
  dayId: string,
): Promise<{ plan: WorkoutPlan; detail: DayDetail }> {
  const supabase = await getSupabase();
  const { data: day } = await supabase
    .from("workout_days")
    .select(DAY_COLS)
    .eq("id", dayId)
    .maybeSingle();
  if (!day) throw new NotFoundError();

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("*")
    .eq("id", day.plan_id)
    .maybeSingle();
  if (!plan) throw new NotFoundError();

  const { data: items } = await supabase
    .from("workout_day_exercises")
    .select(`${PRESC_COLS}, exercise:exercises(${EXERCISE_COLS})`)
    .eq("day_id", dayId)
    .order("order_index");

  return {
    plan: toPlan(plan),
    detail: { day: toDay(day), items: hydrateItems((items ?? []) as Row[]) },
  };
}

export async function getLastLogsByDayExercise(
  _session: Session,
  studentId: string,
  dayId: string,
): Promise<Record<string, SetLog[]>> {
  const supabase = await getSupabase();
  const { data: previous } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("student_id", studentId)
    .eq("day_id", dayId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!previous) return {};

  const { data: logs } = await supabase
    .from("set_logs")
    .select("*")
    .eq("session_id", previous.id)
    .order("set_index");

  const byExercise: Record<string, SetLog[]> = {};
  for (const row of (logs ?? []) as Row[]) {
    if (!row.day_exercise_id) continue;
    (byExercise[row.day_exercise_id as string] ??= []).push(toSetLog(row));
  }
  return byExercise;
}

export async function getActiveSession(session: Session): Promise<WorkoutSession | null> {
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("student_id", session.profile.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toWorkoutSession(data) : null;
}

export async function startWorkout(session: Session, dayId: string): Promise<WorkoutSession> {
  if (session.profile.role !== "student") {
    throw new ForbiddenError("Só o aluno executa treino");
  }
  const { plan } = await getDay(session, dayId);

  const open = await getActiveSession(session);
  if (open?.dayId === dayId) return open;

  // O gatilho `sessions_single_open` encerra qualquer outro treino aberto —
  // inclusive um que suba depois da fila offline de outro aparelho.
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      tenant_id: session.tenant.id,
      student_id: session.profile.id,
      plan_id: plan.id,
      day_id: dayId,
      status: "in_progress",
    })
    .select()
    .single();
  raise(error);
  return toWorkoutSession(data as Row);
}

export async function getSessionLogs(
  _session: Session,
  workoutSessionId: string,
): Promise<SetLog[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("set_logs")
    .select("*")
    .eq("session_id", workoutSessionId)
    .order("set_index");
  raise(error);
  return ((data ?? []) as Row[]).map(toSetLog);
}

export async function logSet(
  session: Session,
  input: {
    workoutSessionId: string;
    dayExerciseId: string;
    setIndex: number;
    reps: number | null;
    loadKg: number | null;
  },
): Promise<SetLog> {
  const supabase = await getSupabase();

  const { data: prescription } = await supabase
    .from("workout_day_exercises")
    .select("id, exercise_id, sets, target_reps, target_load_kg")
    .eq("id", input.dayExerciseId)
    .maybeSingle();
  if (!prescription) throw new NotFoundError();
  if (input.setIndex < 1 || input.setIndex > prescription.sets) {
    throw new NotFoundError("Série fora da prescrição");
  }

  // Idempotente pela chave natural: reenviar a mesma série (fila offline,
  // clique duplo, duas abas) corrige em vez de duplicar.
  const { data, error } = await supabase
    .from("set_logs")
    .upsert(
      {
        tenant_id: session.tenant.id,
        session_id: input.workoutSessionId,
        day_exercise_id: input.dayExerciseId,
        exercise_id: prescription.exercise_id,
        set_index: input.setIndex,
        reps: input.reps,
        load_kg: input.loadKg,
        target_reps: prescription.target_reps,
        target_load_kg: prescription.target_load_kg,
      },
      { onConflict: "session_id,day_exercise_id,set_index" },
    )
    .select()
    .single();
  raise(error);
  return toSetLog(data as Row);
}

export async function undoSet(
  _session: Session,
  workoutSessionId: string,
  dayExerciseId: string,
  setIndex: number,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("set_logs")
    .delete()
    .eq("session_id", workoutSessionId)
    .eq("day_exercise_id", dayExerciseId)
    .eq("set_index", setIndex);
  raise(error);
}

export async function finishWorkout(
  _session: Session,
  workoutSessionId: string,
  input: { perceivedEffort?: number | null; notes?: string | null } = {},
): Promise<WorkoutSession> {
  const supabase = await getSupabase();

  const { data: current } = await supabase
    .from("workout_sessions")
    .select("started_at")
    .eq("id", workoutSessionId)
    .maybeSingle();
  if (!current) throw new NotFoundError();

  const finishedAt = new Date();
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({
      status: "done",
      finished_at: finishedAt.toISOString(),
      duration_seconds: Math.max(
        0,
        Math.round((finishedAt.getTime() - new Date(current.started_at).getTime()) / 1000),
      ),
      perceived_effort: input.perceivedEffort ?? null,
      notes: input.notes ?? null,
    })
    .eq("id", workoutSessionId)
    .select()
    .single();
  raise(error);
  return toWorkoutSession(data as Row);
}

export async function listRecentSessions(
  _session: Session,
  studentId: string,
  limit = 10,
): Promise<WorkoutSession[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(limit);
  raise(error);
  return ((data ?? []) as Row[]).map(toWorkoutSession);
}

// ------------------------------------------------------------------ Resumos

export async function getWeekSummary(
  _session: Session,
  studentId: string,
): Promise<{
  sessions: number;
  targetSessions: number;
  sets: number;
  targetSets: number;
  volumeKg: number;
}> {
  const supabase = await getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();

  let dayCount = 0;
  if (plan) {
    const { count } = await supabase
      .from("workout_days")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id);
    dayCount = count ?? 0;
  }

  const { data: week } = await supabase
    .from("workout_sessions")
    .select("id, day_id")
    .eq("student_id", studentId)
    .eq("status", "done")
    .gte("started_at", since.toISOString());

  const sessionIds = (week ?? []).map((s) => s.id);
  const logs = sessionIds.length
    ? (await supabase.from("set_logs").select("reps, load_kg").in("session_id", sessionIds)).data
    : [];

  const dayIds = [...new Set((week ?? []).map((s) => s.day_id).filter(Boolean))] as string[];
  const prescribed = dayIds.length
    ? (await supabase.from("workout_day_exercises").select("sets").in("day_id", dayIds)).data
    : [];

  const sets = logs?.length ?? 0;
  const targetSets = (prescribed ?? []).reduce((sum, p) => sum + p.sets, 0);

  return {
    sessions: week?.length ?? 0,
    targetSessions: Math.max(1, dayCount),
    sets,
    targetSets: Math.max(targetSets, sets, 1),
    volumeKg: (logs ?? []).reduce(
      (sum, l) => sum + Number(l.load_kg ?? 0) * Number(l.reps ?? 0),
      0,
    ),
  };
}

export async function getSuggestedDay(
  _session: Session,
  studentId: string,
): Promise<WorkoutDay | null> {
  const supabase = await getSupabase();
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("student_id", studentId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) return null;

  const { data: days } = await supabase
    .from("workout_days")
    .select(DAY_COLS)
    .eq("plan_id", plan.id)
    .order("order_index");
  if (!days?.length) return null;

  const { data: last } = await supabase
    .from("workout_sessions")
    .select("day_id")
    .eq("student_id", studentId)
    .eq("status", "done")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last?.day_id) return toDay(days[0]);
  const index = days.findIndex((d) => d.id === last.day_id);
  return toDay(days[index === -1 ? 0 : (index + 1) % days.length]);
}

export async function listStudentsWithActivity(session: Session): Promise<
  {
    student: Profile;
    week: boolean[];
    lastSessionAt: string | null;
    lastDayLabel: string | null;
  }[]
> {
  const students = await listStudents(session);
  if (students.length === 0) return [];

  const supabase = await getSupabase();
  const { data: sessions } = await supabase
    .from("workout_sessions")
    .select("student_id, day_id, started_at, day:workout_days(label, name)")
    .in(
      "student_id",
      students.map((s) => s.id),
    )
    .eq("status", "done")
    .order("started_at", { ascending: false });

  const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };
  const today = startOfDay(new Date());
  const dayStamps = Array.from({ length: 7 }, (_, i) => today - (6 - i) * 86400000);

  return students.map((student) => {
    const mine = (sessions ?? []).filter((s) => s.student_id === student.id);
    const stamps = new Set(mine.map((s) => startOfDay(new Date(s.started_at))));
    const last = mine[0];
    const day = last?.day as unknown as { label: string; name: string } | null;

    return {
      student,
      week: dayStamps.map((t) => stamps.has(t)),
      lastSessionAt: last?.started_at ?? null,
      lastDayLabel: day ? `${day.label} · ${day.name}` : null,
    };
  });
}

// -------------------------------------------------------- Montagem de plano

export async function listExercises(_session: Session): Promise<Exercise[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("exercises")
    .select(EXERCISE_COLS)
    .order("name");
  raise(error);
  return ((data ?? []) as Row[]).map(toExercise);
}

export async function createPlan(
  session: Session,
  studentId: string,
  input: { name: string; goal?: string | null },
): Promise<WorkoutPlan> {
  const supabase = await getSupabase();

  // Índice único parcial: um plano ativo por aluno. Arquivar antes de criar.
  await supabase
    .from("workout_plans")
    .update({ is_active: false, ends_on: new Date().toISOString().slice(0, 10) })
    .eq("student_id", studentId)
    .eq("is_active", true);

  const { data, error } = await supabase
    .from("workout_plans")
    .insert({
      tenant_id: session.tenant.id,
      student_id: studentId,
      created_by: session.profile.id,
      name: input.name,
      goal: input.goal ?? null,
    })
    .select()
    .single();
  raise(error);
  return toPlan(data as Row);
}

export async function updatePlan(
  _session: Session,
  planId: string,
  patch: Partial<Pick<WorkoutPlan, "name" | "goal" | "notes">>,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("workout_plans")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .eq("id", planId);
  raise(error);
}

export async function addDay(
  session: Session,
  planId: string,
  input: { name: string; focus?: string | null },
): Promise<WorkoutDay> {
  const supabase = await getSupabase();
  const { data: existing } = await supabase
    .from("workout_days")
    .select("label")
    .eq("plan_id", planId);

  const used = new Set((existing ?? []).map((d) => d.label));
  const label =
    "ABCDEFGHIJ".split("").find((letter) => !used.has(letter)) ??
    String((existing?.length ?? 0) + 1);

  const { data, error } = await supabase
    .from("workout_days")
    .insert({
      tenant_id: session.tenant.id,
      plan_id: planId,
      label,
      name: input.name,
      focus: input.focus ?? null,
      order_index: existing?.length ?? 0,
    })
    .select(DAY_COLS)
    .single();
  raise(error);
  return toDay(data as Row);
}

export async function updateDay(
  _session: Session,
  dayId: string,
  patch: Partial<Pick<WorkoutDay, "name" | "focus">>,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("workout_days")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.focus !== undefined ? { focus: patch.focus } : {}),
    })
    .eq("id", dayId);
  raise(error);
}

export async function removeDay(_session: Session, dayId: string): Promise<void> {
  const supabase = await getSupabase();
  // `on delete cascade` leva a prescrição junto; a sessão executada só perde o
  // vínculo (`on delete set null`), então o histórico não some.
  const { error } = await supabase.from("workout_days").delete().eq("id", dayId);
  raise(error);
}

export async function addExerciseToDay(
  session: Session,
  dayId: string,
  exerciseId: string,
): Promise<DayExercise> {
  const supabase = await getSupabase();
  const { count } = await supabase
    .from("workout_day_exercises")
    .select("id", { count: "exact", head: true })
    .eq("day_id", dayId);

  const { data, error } = await supabase
    .from("workout_day_exercises")
    .insert({
      tenant_id: session.tenant.id,
      day_id: dayId,
      exercise_id: exerciseId,
      order_index: count ?? 0,
      sets: 3,
      target_reps: "10-12",
      rest_seconds: 60,
    })
    .select(PRESC_COLS)
    .single();
  raise(error);
  return toPrescription(data as Row);
}

export async function updateDayExercise(
  _session: Session,
  dayExerciseId: string,
  patch: Partial<
    Pick<DayExercise, "sets" | "targetReps" | "targetLoadKg" | "restSeconds" | "notes">
  >,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("workout_day_exercises")
    .update({
      ...(patch.sets !== undefined ? { sets: clamp(patch.sets, 1, 20) } : {}),
      ...(patch.restSeconds !== undefined
        ? { rest_seconds: clamp(patch.restSeconds, 0, 900) }
        : {}),
      ...(patch.targetReps !== undefined ? { target_reps: patch.targetReps } : {}),
      ...(patch.targetLoadKg !== undefined ? { target_load_kg: patch.targetLoadKg } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .eq("id", dayExerciseId);
  raise(error);
}

export async function removeDayExercise(
  _session: Session,
  dayExerciseId: string,
): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("workout_day_exercises")
    .delete()
    .eq("id", dayExerciseId);
  raise(error);
}

export async function moveDayExercise(
  _session: Session,
  dayExerciseId: string,
  direction: "up" | "down",
): Promise<void> {
  const supabase = await getSupabase();
  const { data: item } = await supabase
    .from("workout_day_exercises")
    .select("id, day_id, order_index")
    .eq("id", dayExerciseId)
    .maybeSingle();
  if (!item) throw new NotFoundError();

  const { data: list } = await supabase
    .from("workout_day_exercises")
    .select("id, order_index")
    .eq("day_id", item.day_id)
    .order("order_index");
  if (!list) return;

  const index = list.findIndex((x) => x.id === dayExerciseId);
  const swap = direction === "up" ? index - 1 : index + 1;
  if (swap < 0 || swap >= list.length) return;

  // Troca em duas escritas, sem transação: a pior falha possível é a ordem
  // ficar igual, e o próximo clique conserta.
  await supabase
    .from("workout_day_exercises")
    .update({ order_index: list[swap].order_index })
    .eq("id", list[index].id);
  await supabase
    .from("workout_day_exercises")
    .update({ order_index: list[index].order_index })
    .eq("id", list[swap].id);
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));

// ------------------------------------------------------------------ Convites

export async function createInvite(
  session: Session,
  input: { email: string; fullName?: string | null; role: AppRole; assignToMe?: boolean },
): Promise<Invite> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("invites")
    .insert({
      tenant_id: session.tenant.id,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName?.trim() || null,
      role: input.role,
      invited_by: session.profile.id,
      assign_to: input.assignToMe === false ? null : session.profile.id,
    })
    .select()
    .single();
  raise(error);
  return toInvite(data as Row);
}

export async function listPendingInvites(_session: Session): Promise<Invite[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("invites")
    .select("*")
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  raise(error);
  return ((data ?? []) as Row[]).map(toInvite);
}

export async function revokeInvite(_session: Session, inviteId: string): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  raise(error);
}

const toInvite = (r: Row): Invite => ({
  id: r.id as string,
  tenantId: r.tenant_id as string,
  email: r.email as string,
  fullName: (r.full_name as string) ?? null,
  role: r.role as AppRole,
  token: r.token as string,
  invitedBy: (r.invited_by as string) ?? null,
  assignTo: (r.assign_to as string) ?? null,
  acceptedAt: (r.accepted_at as string) ?? null,
  revokedAt: (r.revoked_at as string) ?? null,
  expiresAt: r.expires_at as string,
  createdAt: r.created_at as string,
});
