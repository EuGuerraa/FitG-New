-- =============================================================================
-- FitG — Treino
-- Migration 0002
--
-- Biblioteca de exercícios → plano do aluno → dias (A/B/C ou livres) →
-- exercícios do dia com prescrição → sessões executadas → séries registradas.
--
-- A prescrição (o que o personal manda) e a execução (o que o aluno fez) são
-- tabelas separadas de propósito: mudar o plano não reescreve o histórico.
-- =============================================================================

do $$ begin
  create type public.session_status as enum ('in_progress', 'done', 'skipped');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Biblioteca de exercícios
-- tenant_id nulo = exercício global (catálogo base, legível por todos).
-- -----------------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  name          text not null,
  muscle_group  text not null default 'geral',
  equipment     text,
  video_url     text,
  instructions  text,
  created_at    timestamptz not null default now()
);
create index if not exists exercises_tenant_idx on public.exercises (tenant_id);
create index if not exists exercises_muscle_idx on public.exercises (muscle_group);

-- -----------------------------------------------------------------------------
-- Plano de treino
-- Um plano ativo por aluno por vez; os anteriores ficam como histórico.
-- -----------------------------------------------------------------------------
create table if not exists public.workout_plans (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  name        text not null,
  goal        text,
  notes       text,
  starts_on   date not null default current_date,
  ends_on     date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists plans_student_idx on public.workout_plans (student_id) where is_active;
create unique index if not exists plans_one_active_per_student
  on public.workout_plans (student_id) where is_active;

-- -----------------------------------------------------------------------------
-- Dias do plano (A, B, C… ou nomes livres)
-- -----------------------------------------------------------------------------
create table if not exists public.workout_days (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  plan_id      uuid not null references public.workout_plans(id) on delete cascade,
  label        text not null,
  name         text not null,
  focus        text,
  order_index  int not null default 0,
  unique (plan_id, label)
);
create index if not exists days_plan_idx on public.workout_days (plan_id, order_index);

-- -----------------------------------------------------------------------------
-- Prescrição: exercício dentro de um dia
-- superset_group: exercícios com o mesmo valor são executados em série conjunta.
-- -----------------------------------------------------------------------------
create table if not exists public.workout_day_exercises (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  day_id          uuid not null references public.workout_days(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id) on delete restrict,
  order_index     int not null default 0,
  sets            int not null default 3 check (sets between 1 and 20),
  target_reps     text not null default '10',
  target_load_kg  numeric(6,2),
  rest_seconds    int not null default 60 check (rest_seconds between 0 and 900),
  superset_group  text,
  notes           text
);
create index if not exists day_exercises_day_idx
  on public.workout_day_exercises (day_id, order_index);

-- -----------------------------------------------------------------------------
-- Execução: sessão de treino
-- -----------------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  student_id        uuid not null references public.profiles(id) on delete cascade,
  plan_id           uuid references public.workout_plans(id) on delete set null,
  day_id            uuid references public.workout_days(id) on delete set null,
  status            public.session_status not null default 'in_progress',
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  duration_seconds  int,
  perceived_effort  int check (perceived_effort between 1 and 10),
  notes             text
);
create index if not exists sessions_student_idx
  on public.workout_sessions (student_id, started_at desc);
-- Um treino em andamento por aluno: evita duas abas gravando na mesma sessão.
create unique index if not exists sessions_one_in_progress
  on public.workout_sessions (student_id) where status = 'in_progress';

-- -----------------------------------------------------------------------------
-- Execução: série registrada
-- Guarda a prescrição vigente no momento (target_*) para o histórico não mudar
-- quando o personal editar o plano depois.
-- -----------------------------------------------------------------------------
create table if not exists public.set_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  session_id        uuid not null references public.workout_sessions(id) on delete cascade,
  day_exercise_id   uuid references public.workout_day_exercises(id) on delete set null,
  exercise_id       uuid not null references public.exercises(id) on delete restrict,
  set_index         int not null check (set_index >= 1),
  reps              int check (reps >= 0),
  load_kg           numeric(6,2) check (load_kg >= 0),
  target_reps       text,
  target_load_kg    numeric(6,2),
  is_warmup         boolean not null default false,
  completed_at      timestamptz not null default now(),
  unique (session_id, day_exercise_id, set_index)
);
create index if not exists set_logs_session_idx on public.set_logs (session_id);
create index if not exists set_logs_exercise_idx on public.set_logs (exercise_id, completed_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.exercises             enable row level security;
alter table public.workout_plans         enable row level security;
alter table public.workout_days          enable row level security;
alter table public.workout_day_exercises enable row level security;
alter table public.workout_sessions      enable row level security;
alter table public.set_logs              enable row level security;

-- Exercícios: catálogo global + os do próprio tenant. Só staff escreve.
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
  for select using (tenant_id is null or tenant_id = public.current_tenant_id());

drop policy if exists exercises_write on public.exercises;
create policy exercises_write on public.exercises
  for all using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

-- Planos: o aluno lê o seu; o personal designado lê e escreve.
drop policy if exists plans_select on public.workout_plans;
create policy plans_select on public.workout_plans
  for select using (
    tenant_id = public.current_tenant_id() and public.can_view_student(student_id)
  );

drop policy if exists plans_write on public.workout_plans;
create policy plans_write on public.workout_plans
  for all using (
    tenant_id = public.current_tenant_id()
    and public.is_staff()
    and public.current_role() <> 'nutritionist'
    and public.can_view_student(student_id)
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.is_staff()
    and public.current_role() <> 'nutritionist'
    and public.can_view_student(student_id)
  );

-- Dias e prescrição herdam a permissão do plano.
create or replace function public.can_read_plan(plan uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workout_plans p
    where p.id = plan
      and p.tenant_id = public.current_tenant_id()
      and public.can_view_student(p.student_id)
  )
$$;

create or replace function public.can_write_plan(plan uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_staff()
    and public.current_role() <> 'nutritionist'
    and public.can_read_plan(plan)
$$;

drop policy if exists days_select on public.workout_days;
create policy days_select on public.workout_days
  for select using (public.can_read_plan(plan_id));

drop policy if exists days_write on public.workout_days;
create policy days_write on public.workout_days
  for all using (public.can_write_plan(plan_id))
  with check (public.can_write_plan(plan_id));

drop policy if exists day_exercises_select on public.workout_day_exercises;
create policy day_exercises_select on public.workout_day_exercises
  for select using (
    exists (select 1 from public.workout_days d
            where d.id = day_id and public.can_read_plan(d.plan_id))
  );

drop policy if exists day_exercises_write on public.workout_day_exercises;
create policy day_exercises_write on public.workout_day_exercises
  for all using (
    exists (select 1 from public.workout_days d
            where d.id = day_id and public.can_write_plan(d.plan_id))
  )
  with check (
    exists (select 1 from public.workout_days d
            where d.id = day_id and public.can_write_plan(d.plan_id))
  );

-- Sessões: quem executa é o aluno. O profissional designado lê, não escreve.
drop policy if exists sessions_select on public.workout_sessions;
create policy sessions_select on public.workout_sessions
  for select using (
    tenant_id = public.current_tenant_id() and public.can_view_student(student_id)
  );

drop policy if exists sessions_write on public.workout_sessions;
create policy sessions_write on public.workout_sessions
  for all using (tenant_id = public.current_tenant_id() and student_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and student_id = auth.uid());

drop policy if exists set_logs_select on public.set_logs;
create policy set_logs_select on public.set_logs
  for select using (
    exists (select 1 from public.workout_sessions s
            where s.id = session_id
              and s.tenant_id = public.current_tenant_id()
              and public.can_view_student(s.student_id))
  );

drop policy if exists set_logs_write on public.set_logs;
create policy set_logs_write on public.set_logs
  for all using (
    exists (select 1 from public.workout_sessions s
            where s.id = session_id and s.student_id = auth.uid())
  )
  with check (
    exists (select 1 from public.workout_sessions s
            where s.id = session_id and s.student_id = auth.uid())
  );
