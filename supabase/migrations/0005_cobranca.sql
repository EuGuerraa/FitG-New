-- =============================================================================
-- FitG — Cobrança e assinatura
-- Migration 0005
--
-- Duas coisas diferentes com o mesmo nome:
--   1. o que o ALUNO paga ao personal (mensalidade do acompanhamento);
--   2. o que o PERSONAL paga ao FitG (assinatura da plataforma).
-- Aqui está a (1), que é o produto. A (2) fica em `tenants.plan` e no provedor
-- externo, porque ainda não decidimos o modelo de negócio.
--
-- Dinheiro é sempre inteiro em centavos: `numeric` com fração vira bug de
-- arredondamento na primeira divisão.
-- =============================================================================

do $$ begin
  create type public.billing_interval as enum ('monthly', 'quarterly', 'semiannual', 'annual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'past_due', 'canceled', 'trialing');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('open', 'paid', 'overdue', 'canceled', 'refunded');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Planos que o personal oferece
-- -----------------------------------------------------------------------------
create table if not exists public.billing_plans (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  description   text,
  price_cents   int not null check (price_cents >= 0),
  currency      char(3) not null default 'BRL',
  interval      public.billing_interval not null default 'monthly',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists billing_plans_tenant_idx on public.billing_plans (tenant_id);

-- -----------------------------------------------------------------------------
-- Assinatura do aluno
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  student_id         uuid not null references public.profiles(id) on delete cascade,
  billing_plan_id    uuid references public.billing_plans(id) on delete set null,
  status             public.subscription_status not null default 'active',
  /* Dia do mês em que vence — o que o personal realmente controla. */
  due_day            int not null default 5 check (due_day between 1 and 28),
  started_on         date not null default current_date,
  canceled_on        date,
  current_period_end date,
  /* Id no provedor de pagamento, quando houver. Nunca guardamos cartão. */
  external_ref       text,
  notes              text,
  created_at         timestamptz not null default now()
);
create unique index if not exists subscriptions_one_active_per_student
  on public.subscriptions (student_id) where status in ('active', 'trialing', 'past_due');
create index if not exists subscriptions_tenant_idx on public.subscriptions (tenant_id, status);

-- -----------------------------------------------------------------------------
-- Faturas
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  student_id       uuid not null references public.profiles(id) on delete cascade,
  amount_cents     int not null check (amount_cents >= 0),
  currency         char(3) not null default 'BRL',
  reference_month  date not null,
  due_on           date not null,
  paid_at          timestamptz,
  status           public.invoice_status not null default 'open',
  method           text,
  external_ref     text,
  notes            text,
  created_at       timestamptz not null default now(),
  unique (subscription_id, reference_month)
);
create index if not exists invoices_tenant_idx on public.invoices (tenant_id, status, due_on);
create index if not exists invoices_student_idx on public.invoices (student_id, due_on desc);

-- -----------------------------------------------------------------------------
-- RLS
--
-- Dinheiro é do dono do negócio. O owner enxerga e mexe em tudo do tenant; o
-- personal vê a situação dos alunos dele (para saber quem está inadimplente),
-- mas não edita valores; o aluno vê só as próprias faturas; o nutricionista
-- não vê nada disso.
-- -----------------------------------------------------------------------------
alter table public.billing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices      enable row level security;

create or replace function public.can_see_money(target uuid)
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
        and a.staff_role = 'trainer'
        and a.is_active
    )
$$;

drop policy if exists billing_plans_select on public.billing_plans;
create policy billing_plans_select on public.billing_plans
  for select using (tenant_id = public.current_tenant_id() and public.is_staff());

drop policy if exists billing_plans_write on public.billing_plans;
create policy billing_plans_write on public.billing_plans
  for all using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (
    tenant_id = public.current_tenant_id() and public.can_see_money(student_id)
  );

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions
  for all using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id() and public.is_owner());

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select using (
    tenant_id = public.current_tenant_id() and public.can_see_money(student_id)
  );

drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices
  for all using (tenant_id = public.current_tenant_id() and public.is_owner())
  with check (tenant_id = public.current_tenant_id() and public.is_owner());
