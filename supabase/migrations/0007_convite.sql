-- =============================================================================
-- FitG — Entrada do aluno por convite
-- Migration 0007
--
-- O problema: para existir, um perfil precisa de tenant e papel — e quem está
-- chegando ainda não tem nenhum dos dois, então nenhuma política de RLS pode
-- autorizá-lo a se inserir. A saída errada seria dar uma chave `service_role`
-- para a aplicação. A saída certa é esta: duas funções SECURITY DEFINER, com
-- escopo minúsculo e auditável, que fazem exatamente um passo privilegiado cada.
--
-- `invite_preview` conta o mínimo para a tela de boas-vindas existir.
-- `accept_invite` cria o perfil de quem já se autenticou, e só se o e-mail da
-- conta for o mesmo do convite. O token sozinho não basta: quem interceptar o
-- link não consegue usá-lo com outra conta.
-- =============================================================================

-- Token imprevisível por padrão, gerado no banco em vez de no cliente.
alter table public.invites
  alter column token set default encode(gen_random_bytes(24), 'hex');

-- Nome sugerido pelo profissional e vínculo automático ao aceitar: o aluno já
-- entra ligado a quem o convidou, sem um segundo passo manual.
alter table public.invites add column if not exists full_name text;
alter table public.invites add column if not exists assign_to uuid
  references public.profiles(id) on delete set null;
alter table public.invites add column if not exists revoked_at timestamptz;

create index if not exists invites_token_idx on public.invites (token);
create unique index if not exists invites_open_per_email
  on public.invites (tenant_id, lower(email))
  where accepted_at is null and revoked_at is null;

-- -----------------------------------------------------------------------------
-- Leitura pública e mínima do convite
--
-- Devolve só o que a tela de boas-vindas precisa mostrar. Não devolve id de
-- ninguém, nem diz se o e-mail já tem conta. Convite inválido, expirado,
-- revogado ou já aceito devolve nada — sem distinguir os casos, para o link
-- não virar oráculo.
-- -----------------------------------------------------------------------------
create or replace function public.invite_preview(p_token text)
returns table (tenant_name text, brand_color text, email text, role public.app_role, full_name text)
language sql stable security definer set search_path = public
as $$
  select t.name, t.brand_color, i.email, i.role, i.full_name
  from public.invites i
  join public.tenants t on t.id = i.tenant_id
  where i.token = p_token
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
$$;

revoke all on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Aceite
--
-- Pré-condições, todas checadas aqui dentro:
--   · existe sessão (auth.uid() não é nulo);
--   · o convite é válido, não expirou, não foi revogado nem aceito;
--   · o e-mail da conta autenticada é o mesmo do convite;
--   · a pessoa ainda não tem perfil.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invite(p_token text, p_full_name text default null)
returns public.app_role
language plpgsql security definer set search_path = public
as $$
declare
  v_invite public.invites;
  v_email  text;
  v_name   text;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado para aceitar o convite'
      using errcode = '28000';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select * into v_invite
  from public.invites
  where token = p_token
    and accepted_at is null
    and revoked_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Convite inválido ou expirado' using errcode = '22023';
  end if;

  if lower(v_invite.email) <> lower(v_email) then
    raise exception 'Este convite é de outro e-mail' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Esta conta já pertence a um estúdio' using errcode = '23505';
  end if;

  v_name := coalesce(nullif(trim(p_full_name), ''), v_invite.full_name, split_part(v_email, '@', 1));

  insert into public.profiles (id, tenant_id, role, full_name, email)
  values (auth.uid(), v_invite.tenant_id, v_invite.role, v_name, v_email);

  -- Vínculo automático com quem convidou, quando faz sentido.
  if v_invite.assign_to is not null and v_invite.role = 'student' then
    insert into public.assignments (tenant_id, student_id, staff_id, staff_role)
    select v_invite.tenant_id, auth.uid(), p.id,
           case when p.role = 'nutritionist' then 'nutritionist'::public.app_role
                else 'trainer'::public.app_role end
    from public.profiles p
    where p.id = v_invite.assign_to and p.role <> 'student'
    on conflict (student_id, staff_id, staff_role) do nothing;
  end if;

  update public.invites set accepted_at = now() where id = v_invite.id;

  return v_invite.role;
end $$;

revoke all on function public.accept_invite(text, text) from public;
grant execute on function public.accept_invite(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- A política de convites passa a excluir os revogados da escrita comum e
-- permite que o profissional convide — inclusive o nutricionista, que também
-- traz aluno.
-- -----------------------------------------------------------------------------
drop policy if exists invites_all on public.invites;
create policy invites_all on public.invites
  for all using (tenant_id = public.current_tenant_id() and public.is_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_staff());
