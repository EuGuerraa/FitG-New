// =============================================================================
// FitG — modelo de domínio
// Espelha 1:1 o schema em supabase/migrations. Quando o Supabase entrar, estes
// tipos passam a ser gerados do banco e nada acima da camada de dados muda.
// =============================================================================

export type AppRole = "owner" | "trainer" | "nutritionist" | "student";
export type TenantPlan = "trial" | "solo" | "studio";

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Administrador",
  trainer: "Personal trainer",
  nutritionist: "Nutricionista",
  student: "Aluno",
};

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  brandColor: string;
  logoUrl: string | null;
  plan: TenantPlan;
  createdAt: string;
};

export type Profile = {
  id: string;
  tenantId: string;
  role: AppRole;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  birthDate: string | null;
  isActive: boolean;
  createdAt: string;
};

export type Assignment = {
  id: string;
  tenantId: string;
  studentId: string;
  staffId: string;
  staffRole: Extract<AppRole, "trainer" | "nutritionist">;
  isActive: boolean;
  startedAt: string;
  endedAt: string | null;
};

export type Invite = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  token: string;
  invitedBy: string | null;
  /** Profissional a quem o aluno fica vinculado ao aceitar. */
  assignTo: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

/** O que a tela pública de convite mostra — de propósito, quase nada. */
export type InvitePreview = {
  tenantName: string;
  brandColor: string;
  email: string;
  role: AppRole;
  fullName: string | null;
};

/** Identidade resolvida do request — o equivalente ao `auth.uid()` do Postgres. */
export type Session = {
  profile: Profile;
  tenant: Tenant;
};

export type StaffKind = Extract<AppRole, "trainer" | "nutritionist">;

export const isStaff = (role: AppRole): boolean => role !== "student";
export const isOwner = (role: AppRole): boolean => role === "owner";

// =============================================================================
// Treino — espelha supabase/migrations/0002_treino.sql
// =============================================================================

export type SessionStatus = "in_progress" | "done" | "skipped";

export type Exercise = {
  id: string;
  /** null = catálogo global, legível por todos os tenants. */
  tenantId: string | null;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  videoUrl: string | null;
  instructions: string | null;
};

export type WorkoutPlan = {
  id: string;
  tenantId: string;
  studentId: string;
  createdBy: string | null;
  name: string;
  goal: string | null;
  notes: string | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  createdAt: string;
};

export type WorkoutDay = {
  id: string;
  tenantId: string;
  planId: string;
  label: string;
  name: string;
  focus: string | null;
  orderIndex: number;
};

/** Prescrição: o que o personal mandou fazer. */
export type DayExercise = {
  id: string;
  tenantId: string;
  dayId: string;
  exerciseId: string;
  orderIndex: number;
  sets: number;
  targetReps: string;
  targetLoadKg: number | null;
  restSeconds: number;
  supersetGroup: string | null;
  notes: string | null;
};

/** Execução: uma ida à academia. */
export type WorkoutSession = {
  id: string;
  tenantId: string;
  studentId: string;
  planId: string | null;
  dayId: string | null;
  status: SessionStatus;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  perceivedEffort: number | null;
  notes: string | null;
};

/** Execução: uma série. Carrega a prescrição vigente para o histórico não mudar. */
export type SetLog = {
  id: string;
  tenantId: string;
  sessionId: string;
  dayExerciseId: string | null;
  exerciseId: string;
  setIndex: number;
  reps: number | null;
  loadKg: number | null;
  targetReps: string | null;
  targetLoadKg: number | null;
  isWarmup: boolean;
  completedAt: string;
};

/** Um dia com tudo que a tela precisa, já resolvido. */
export type DayDetail = {
  day: WorkoutDay;
  items: { prescription: DayExercise; exercise: Exercise }[];
};

export type PlanDetail = {
  plan: WorkoutPlan;
  days: DayDetail[];
};
