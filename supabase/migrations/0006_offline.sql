-- =============================================================================
-- FitG — Suporte a registro offline
-- Migration 0006
--
-- Academia tem sinal ruim. O aluno registra série com o telefone no chão, às
-- vezes no subsolo. Então a escrita do treino (e do registro de refeição e do
-- check-in) precisa acontecer local primeiro e subir depois.
--
-- A regra que faz isso funcionar: o CLIENTE gera o uuid da linha. Reenviar a
-- mesma escrita duas vezes não duplica, porque a chave primária já existe.
-- Combinado com as chaves naturais que já estavam no schema
-- (`set_logs (session_id, day_exercise_id, set_index)` e
-- `meal_logs (student_id, meal_id, on_date)`), a sincronização vira um upsert
-- idempotente em vez de uma máquina de conciliação.
--
-- Conflito entre dois aparelhos resolve por `updated_at`: vence a escrita mais
-- recente. É o que faz sentido aqui — dois dispositivos registrando a mesma
-- série do mesmo treino é corrigir, não concorrer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Carimbo de atualização nas tabelas que a fila offline escreve
-- -----------------------------------------------------------------------------
alter table public.workout_sessions add column if not exists updated_at timestamptz not null default now();
alter table public.set_logs         add column if not exists updated_at timestamptz not null default now();
alter table public.meal_logs        add column if not exists updated_at timestamptz not null default now();
alter table public.water_logs       add column if not exists updated_at timestamptz not null default now();
alter table public.assessments      add column if not exists updated_at timestamptz not null default now();

drop trigger if exists workout_sessions_touch on public.workout_sessions;
create trigger workout_sessions_touch before update on public.workout_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists set_logs_touch on public.set_logs;
create trigger set_logs_touch before update on public.set_logs
  for each row execute function public.touch_updated_at();

drop trigger if exists meal_logs_touch on public.meal_logs;
create trigger meal_logs_touch before update on public.meal_logs
  for each row execute function public.touch_updated_at();

drop trigger if exists water_logs_touch on public.water_logs;
create trigger water_logs_touch before update on public.water_logs
  for each row execute function public.touch_updated_at();

drop trigger if exists assessments_touch on public.assessments;
create trigger assessments_touch before update on public.assessments
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- De onde veio a escrita
-- Serve para depurar ("o treino subiu duas vezes, de que aparelho?") e para a
-- app ignorar o eco da própria escrita ao receber o realtime.
-- -----------------------------------------------------------------------------
alter table public.workout_sessions add column if not exists device_id text;
alter table public.set_logs         add column if not exists device_id text;

-- -----------------------------------------------------------------------------
-- Janela de sincronização
-- O cliente pergunta "o que mudou desde X?" e recebe só o delta. Os índices
-- abaixo são o que tornam essa pergunta barata.
-- -----------------------------------------------------------------------------
create index if not exists workout_sessions_sync_idx
  on public.workout_sessions (student_id, updated_at desc);
create index if not exists set_logs_sync_idx
  on public.set_logs (session_id, updated_at desc);
create index if not exists meal_logs_sync_idx
  on public.meal_logs (student_id, updated_at desc);

-- -----------------------------------------------------------------------------
-- O índice único parcial de "um treino em andamento por aluno" atrapalha a fila
-- offline: se o aparelho A abriu um treino que ainda não subiu e o aparelho B
-- abre outro, a sincronização quebraria com violação de índice em vez de
-- resolver. Trocamos por uma checagem no servidor, que pode decidir qual encerrar.
-- -----------------------------------------------------------------------------
drop index if exists sessions_one_in_progress;

create or replace function public.close_other_open_sessions()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'in_progress' then
    update public.workout_sessions
       set status = 'skipped',
           finished_at = coalesce(finished_at, now())
     where student_id = new.student_id
       and status = 'in_progress'
       and id <> new.id
       and started_at < new.started_at;
  end if;
  return new;
end $$;

drop trigger if exists sessions_single_open on public.workout_sessions;
create trigger sessions_single_open after insert or update on public.workout_sessions
  for each row execute function public.close_other_open_sessions();
