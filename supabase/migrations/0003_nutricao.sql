-- =============================================================================
-- FitG — Nutrição
-- Migration 0003
--
-- Catálogo de alimentos → plano alimentar do aluno → refeições do dia → itens
-- da refeição → registro do que o aluno realmente comeu.
--
-- Mesma separação do treino: prescrição (o nutricionista monta) e execução (o
-- aluno registra) em tabelas distintas, e o registro congela o alvo do momento.
-- Quem escreve o plano é o nutricionista; o personal lê para ter contexto.
-- =============================================================================

do $$ begin
  create type public.meal_status as enum ('ate', 'partial', 'skipped');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Catálogo de alimentos
-- tenant_id nulo = alimento global (tabela base, legível por todos).
-- Valores sempre por 100 g ou por 100 ml, normalizados na entrada.
-- -----------------------------------------------------------------------------
create table if not exists public.foods (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  name          text not null,
  brand         text,
  /* 'g' para sólidos, 'ml' para líquidos, 'un' para unidades (ovo, fatia). */
  base_unit     text not null default 'g' check (base_unit in ('g', 'ml', 'un')),
  /* Quanto vale uma unidade quando base_unit = 'un' (ex.: 1 ovo = 50 g). */
  unit_grams    numeric(7,2),
  kcal          numeric(7,2) not null default 0 check (kcal >= 0),
  protein_g     numeric(7,2) not null default 0 check (protein_g >= 0),
  carb_g        numeric(7,2) not null default 0 check (carb_g >= 0),
  fat_g         numeric(7,2) not null default 0 check (fat_g >= 0),
  fiber_g       numeric(7,2),
  created_at    timestamptz not null default now()
);
create index if not exists foods_tenant_idx on public.foods (tenant_id);
create index if not exists foods_name_idx on public.foods (lower(name));

-- -----------------------------------------------------------------------------
-- Plano alimentar
-- Um ativo por aluno por vez, igual ao plano de treino.
-- -----------------------------------------------------------------------------
create table if not exists public.meal_plans (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  created_by     uuid references public.profiles(id) on delete set null,
  name           text not null,
  goal           text,
  notes          text,
  kcal_target    numeric(7,2),
  protein_target_g numeric(7,2),
  carb_target_g  numeric(7,2),
  fat_target_g   numeric(7,2),
  water_target_ml int check (water_target_ml >= 0),
  starts_on      date not null default current_date,
  ends_on        date,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
create unique index if not exists meal_plans_one_active_per_student
  on public.meal_plans (student_id) where is_active;

-- -----------------------------------------------------------------------------
-- Refeições do plano
-- -----------------------------------------------------------------------------
create table if not exists public.meals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  meal_plan_id  uuid not null references public.meal_plans(id) on delete cascade,
  name          text not null,
  time_of_day   time,
  order_index   int not null default 0,
  notes         text
);
create index if not exists meals_plan_idx on public.meals (meal_plan_id, order_index);

create table if not exists public.meal_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  meal_id       uuid not null references public.meals(id) on delete cascade,
  food_id       uuid not null references public.foods(id) on delete restrict,
  quantity      numeric(7,2) not null check (quantity > 0),
  /* Unidade em que o aluno enxerga: 'g', 'ml' ou 'un'. */
  unit          text not null default 'g' check (unit in ('g', 'ml', 'un')),
  order_index   int not null default 0,
  /* Alternativas ("ou 2 fatias de pão") ficam agrupadas pelo mesmo valor. */
  swap_group    text,
  notes         text
);
create index if not exists meal_items_meal_idx on public.meal_items (meal_id, order_index);

-- -----------------------------------------------------------------------------
-- Execução: o que o aluno de fato comeu
-- Um registro por refeição por dia; o id vem do cliente para o registro offline
-- poder ser reenviado sem duplicar (ver 0006_sync.sql).
-- -----------------------------------------------------------------------------
create table if not exists public.meal_logs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  meal_id       uuid references public.meals(id) on delete set null,
  on_date       date not null default current_date,
  status        public.meal_status not null default 'ate',
  /* Congela o alvo do momento: editar o plano depois não reescreve o histórico. */
  kcal          numeric(7,2),
  protein_g     numeric(7,2),
  carb_g        numeric(7,2),
  fat_g         numeric(7,2),
  notes         text,
  photo_path    text,
  logged_at     timestamptz not null default now(),
  unique (student_id, meal_id, on_date)
);
create index if not exists meal_logs_student_idx on public.meal_logs (student_id, on_date desc);

create table if not exists public.water_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  on_date     date not null default current_date,
  amount_ml   int not null check (amount_ml > 0),
  logged_at   timestamptz not null default now()
);
create index if not exists water_logs_student_idx on public.water_logs (student_id, on_date desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.foods       enable row level security;
alter table public.meal_plans  enable row level security;
alter table public.meals       enable row level security;
alter table public.meal_items  enable row level security;
alter table public.meal_logs   enable row level security;
alter table public.water_logs  enable row level security;

-- Quem monta dieta: nutricionista e owner. O personal lê, não escreve.
create or replace function public.can_write_diet()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.current_role() in ('nutritionist', 'owner') $$;

drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods
  for select using (tenant_id is null or tenant_id = public.current_tenant_id());

drop policy if exists foods_write on public.foods;
create policy foods_write on public.foods
  for all using (tenant_id = public.current_tenant_id() and public.can_write_diet())
  with check (tenant_id = public.current_tenant_id() and public.can_write_diet());

drop policy if exists meal_plans_select on public.meal_plans;
create policy meal_plans_select on public.meal_plans
  for select using (
    tenant_id = public.current_tenant_id() and public.can_view_student(student_id)
  );

drop policy if exists meal_plans_write on public.meal_plans;
create policy meal_plans_write on public.meal_plans
  for all using (
    tenant_id = public.current_tenant_id()
    and public.can_write_diet()
    and public.can_view_student(student_id)
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.can_write_diet()
    and public.can_view_student(student_id)
  );

create or replace function public.can_read_meal_plan(plan uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.meal_plans p
    where p.id = plan
      and p.tenant_id = public.current_tenant_id()
      and public.can_view_student(p.student_id)
  )
$$;

create or replace function public.can_write_meal_plan(plan uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.can_write_diet() and public.can_read_meal_plan(plan) $$;

drop policy if exists meals_select on public.meals;
create policy meals_select on public.meals
  for select using (public.can_read_meal_plan(meal_plan_id));

drop policy if exists meals_write on public.meals;
create policy meals_write on public.meals
  for all using (public.can_write_meal_plan(meal_plan_id))
  with check (public.can_write_meal_plan(meal_plan_id));

drop policy if exists meal_items_select on public.meal_items;
create policy meal_items_select on public.meal_items
  for select using (
    exists (select 1 from public.meals m
            where m.id = meal_id and public.can_read_meal_plan(m.meal_plan_id))
  );

drop policy if exists meal_items_write on public.meal_items;
create policy meal_items_write on public.meal_items
  for all using (
    exists (select 1 from public.meals m
            where m.id = meal_id and public.can_write_meal_plan(m.meal_plan_id))
  )
  with check (
    exists (select 1 from public.meals m
            where m.id = meal_id and public.can_write_meal_plan(m.meal_plan_id))
  );

-- Registro é do aluno: a equipe designada lê, só ele escreve.
drop policy if exists meal_logs_select on public.meal_logs;
create policy meal_logs_select on public.meal_logs
  for select using (
    tenant_id = public.current_tenant_id() and public.can_view_student(student_id)
  );

drop policy if exists meal_logs_write on public.meal_logs;
create policy meal_logs_write on public.meal_logs
  for all using (tenant_id = public.current_tenant_id() and student_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and student_id = auth.uid());

drop policy if exists water_logs_select on public.water_logs;
create policy water_logs_select on public.water_logs
  for select using (
    tenant_id = public.current_tenant_id() and public.can_view_student(student_id)
  );

drop policy if exists water_logs_write on public.water_logs;
create policy water_logs_write on public.water_logs
  for all using (tenant_id = public.current_tenant_id() and student_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and student_id = auth.uid());
