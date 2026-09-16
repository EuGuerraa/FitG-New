-- =============================================================================
-- FitG — Fundação: multi-tenant, papéis e RLS
-- Migration 0001
--
-- Modelo: cada personal trainer (ou estúdio) é um TENANT. Todo dado pertence a
-- um tenant. Dentro do tenant, o papel (owner / trainer / nutritionist /
-- student) define o que se enxerga. Nada disso depende do frontend: as políticas
-- abaixo são a única fonte de verdade de autorização.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('owner', 'trainer', 'nutritionist', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tenant_plan as enum ('trial', 'solo', 'studio');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Tenants (o "white-label": marca, cor, logo de cada personal/estúdio)
-- -----------------------------------------------------------------------------
create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  brand_color   text not null default '#C8FF4D',
  logo_url      text,
  plan          public.tenant_plan not null default 'trial',
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Profiles (1:1 com auth.users) — quem é a pessoa e em que tenant/papel
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        public.app_role not null default 'student',
  full_name   text not null default '',
  email       text,
  avatar_url  text,
  phone       text,
  birth_date  date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_tenant_idx on public.profiles (tenant_id);
create index if not exists profiles_tenant_role_idx on public.profiles (tenant_id, role);

-- -----------------------------------------------------------------------------
-- Helpers de autorização
--
-- SECURITY DEFINER + search_path fixo: lêem profiles sem disparar as próprias
-- políticas de profiles (evita recursão infinita nas policies).
-- -----------------------------------------------------------------------------
create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select tenant_id from public.profiles where id = auth.uid() $$;

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.current_role() in ('owner', 'trainer', 'nutritionist') $$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.current_role() = 'owner' $$;

-- -----------------------------------------------------------------------------
-- Vínculos aluno <-> profissional
--
-- Um aluno pode ter um personal e um nutricionista (ou vários, ao longo do
-- tempo). É esta tabela que autoriza o profissional a ver o aluno.
-- -----------------------------------------------------------------------------
create table if not exists public.assignments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  staff_id      uuid not null references public.profiles(id) on delete cascade,
  staff_role    public.app_role not null check (staff_role in ('trainer', 'nutritionist')),
  is_active     boolean not null default true,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  unique (student_id, staff_id, staff_role)
);
create index if not exists assignments_tenant_idx on public.assignments (tenant_id);
create index if not exists assignments_student_idx on public.assignments (student_id) where is_active;
create index if not exists assignments_staff_idx on public.assignments (staff_id) where is_active;

-- Um profissional enxerga este aluno?
create or replace function public.can_view_student(target uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    target = auth.uid()
    or public.is_owner()
    or exists (
      select 1 from public.assignments a
      where a.student_id = target
        and a.staff_id = auth.uid()
        and a.is_active
    )
$$;

-- -----------------------------------------------------------------------------
-- Convites (como um aluno entra no tenant sem cadastro aberto)
-- -----------------------------------------------------------------------------
create table if not exists public.invites (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  role        public.app_role not null default 'student',
  token       text not null unique,
  invited_by  uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);
create index if not exists invites_tenant_idx on public.invites (tenant_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.tenants     enable row level security;
alter table public.profiles    enable row level security;
alter table public.assignments enable row level security;
alter table public.invites     enable row level security;

-- tenants: qualquer membro lê o próprio tenant; só o owner edita.
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (id = public.current_tenant_id());

drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update using (id = public.current_tenant_id() and public.is_owner())
  with check (id = public.current_tenant_id());

-- profiles: sempre dentro do tenant. Aluno vê a si mesmo e a sua equipe
-- designada; staff vê a si mesmo, os colegas e os alunos designados.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    tenant_id = public.current_tenant_id()
    and (
      id = auth.uid()
      or public.is_owner()
      or (public.is_staff() and public.can_view_student(id))
      or (public.is_staff() and role <> 'student')
      or exists (
        select 1 from public.assignments a
        where a.student_id = auth.uid() and a.staff_id = profiles.id and a.is_active
      )
    )
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and tenant_id = public.current_tenant_id());

drop policy if exists profiles_update_staff on public.profiles;
create policy profiles_update_staff on public.profiles
  for update using (
    tenant_id = public.current_tenant_id()
    and (public.is_owner() or (public.is_staff() and public.can_view_student(id)))
  )
  with check (tenant_id = public.current_tenant_id());

-- assignments: staff do tenant gerencia; aluno lê os próprios vínculos.
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select using (
    tenant_id = public.current_tenant_id()
    and (student_id = auth.uid() or staff_id = auth.uid() or public.is_owner())
  );

drop policy if exists assignments_write on public.assignments;
create policy assignments_write on public.assignments
  for all using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

-- invites: só staff.
drop policy if exists invites_all on public.invites;
create policy invites_all on public.invites
  for all using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
