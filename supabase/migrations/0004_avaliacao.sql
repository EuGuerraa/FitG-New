-- =============================================================================
-- FitG — Avaliação física
-- Migration 0004
--
-- Peso, medidas, dobras e fotos de progresso. É o módulo mais sensível do
-- produto: foto de corpo é dado íntimo. Por isso as fotos ficam num bucket
-- privado do Storage, a tabela guarda só o caminho, e a política de leitura é
-- mais estreita que a dos outros módulos — nem todo staff do tenant vê, só o
-- profissional designado àquele aluno.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Check-in / avaliação
-- Duas origens: o aluno registrando o peso da semana, ou o profissional fazendo
-- uma avaliação completa. Mesma tabela, campos opcionais.
-- -----------------------------------------------------------------------------
create table if not exists public.assessments (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  created_by     uuid references public.profiles(id) on delete set null,
  on_date        date not null default current_date,
  weight_kg      numeric(5,2) check (weight_kg > 0 and weight_kg < 500),
  height_cm      numeric(5,1) check (height_cm > 0 and height_cm < 300),
  body_fat_pct   numeric(4,1) check (body_fat_pct >= 0 and body_fat_pct <= 100),
  lean_mass_kg   numeric(5,2) check (lean_mass_kg >= 0),
  resting_hr     int check (resting_hr between 20 and 250),
  notes          text,
  created_at     timestamptz not null default now(),
  unique (student_id, on_date)
);
create index if not exists assessments_student_idx
  on public.assessments (student_id, on_date desc);

-- -----------------------------------------------------------------------------
-- Medidas e dobras
-- Chave livre em vez de uma coluna por parte do corpo: cada profissional mede
-- o que quer, e incluir "panturrilha direita" não vira migration.
-- -----------------------------------------------------------------------------
create table if not exists public.assessment_measures (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  assessment_id  uuid not null references public.assessments(id) on delete cascade,
  kind           text not null check (kind in ('circumference', 'skinfold')),
  /* 'cintura', 'quadril', 'braco_direito', 'triciptal'… */
  key            text not null,
  value_mm       numeric(6,1) not null check (value_mm >= 0),
  order_index    int not null default 0,
  unique (assessment_id, kind, key)
);
create index if not exists measures_assessment_idx
  on public.assessment_measures (assessment_id, order_index);

-- -----------------------------------------------------------------------------
-- Fotos de progresso
-- `storage_path` aponta para o bucket privado 'progress-photos'. A imagem nunca
-- é pública: o acesso sai de URL assinada, gerada no servidor depois de a
-- política abaixo autorizar a linha.
-- -----------------------------------------------------------------------------
create table if not exists public.progress_photos (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  assessment_id  uuid references public.assessments(id) on delete set null,
  storage_path   text not null unique,
  pose           text not null default 'front' check (pose in ('front', 'side', 'back', 'other')),
  /* O aluno decide se a equipe vê. Padrão: não vê. */
  shared_with_staff boolean not null default false,
  taken_at       timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists photos_student_idx
  on public.progress_photos (student_id, taken_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.assessments         enable row level security;
alter table public.assessment_measures enable row level security;
alter table public.progress_photos     enable row level security;

drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments
  for select using (
    tenant_id = public.current_tenant_id() and public.can_view_student(student_id)
  );

-- Escrevem: o próprio aluno (check-in de peso) e o profissional designado.
drop policy if exists assessments_write on public.assessments;
create policy assessments_write on public.assessments
  for all using (
    tenant_id = public.current_tenant_id()
    and (student_id = auth.uid() or (public.is_staff() and public.can_view_student(student_id)))
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (student_id = auth.uid() or (public.is_staff() and public.can_view_student(student_id)))
  );

create or replace function public.can_read_assessment(assessment uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.assessments a
    where a.id = assessment
      and a.tenant_id = public.current_tenant_id()
      and public.can_view_student(a.student_id)
  )
$$;

drop policy if exists measures_select on public.assessment_measures;
create policy measures_select on public.assessment_measures
  for select using (public.can_read_assessment(assessment_id));

drop policy if exists measures_write on public.assessment_measures;
create policy measures_write on public.assessment_measures
  for all using (public.is_staff() and public.can_read_assessment(assessment_id))
  with check (public.is_staff() and public.can_read_assessment(assessment_id));

-- Fotos: o dono sempre; a equipe designada só se o aluno tiver compartilhado.
-- O owner NÃO é exceção aqui — ser administrador do estúdio não dá direito a
-- ver o corpo de todo mundo.
drop policy if exists photos_select on public.progress_photos;
create policy photos_select on public.progress_photos
  for select using (
    tenant_id = public.current_tenant_id()
    and (
      student_id = auth.uid()
      or (
        shared_with_staff
        and exists (
          select 1 from public.assignments a
          where a.student_id = progress_photos.student_id
            and a.staff_id = auth.uid()
            and a.is_active
        )
      )
    )
  );

drop policy if exists photos_write on public.progress_photos;
create policy photos_write on public.progress_photos
  for all using (tenant_id = public.current_tenant_id() and student_id = auth.uid())
  with check (tenant_id = public.current_tenant_id() and student_id = auth.uid());
