-- =============================================================================
-- FitG — dados de demonstração
--
-- Re-executável: tudo é `on conflict do nothing` ou resolvido por chave natural.
-- Os perfis são ligados às contas de auth pelo e-mail, então este arquivo não
-- carrega nenhum id de usuário e funciona em qualquer ambiente onde as contas
-- de demonstração já tenham sido criadas.
--
-- Contas (senha demo1234):
--   igor@studioguerra.app    administrador e personal — vê todos os alunos
--   marina@studioguerra.app  personal                 — vê só o Bruno
--   rafael@studioguerra.app  nutricionista            — vê Ana e Carla
--   ana@exemplo.com          aluna                    — treino + nutrição
--   bruno@exemplo.com        aluno                    — só treino
--   carla@exemplo.com        aluna                    — só nutrição
-- =============================================================================

-- ----------------------------------------------------------------- Tenant --
insert into public.tenants (id, slug, name, brand_color, plan)
values ('11111111-1111-4111-8111-111111111111', 'studio-guerra', 'Studio Guerra', '#E8A33D', 'studio')
on conflict (id) do update set name = excluded.name, brand_color = excluded.brand_color;

-- ---------------------------------------------------------------- Perfis --
insert into public.profiles (id, tenant_id, role, full_name, email, birth_date)
select u.id, '11111111-1111-4111-8111-111111111111', v.role::public.app_role, v.full_name, u.email, v.birth_date::date
from (values
  ('igor@studioguerra.app',   'owner',        'Igor Guerra',   '1999-04-12'),
  ('marina@studioguerra.app', 'trainer',      'Marina Duarte', '1994-08-02'),
  ('rafael@studioguerra.app', 'nutritionist', 'Rafael Lima',   '1990-02-20'),
  ('ana@exemplo.com',         'student',      'Ana Carolina',  '2000-06-15'),
  ('bruno@exemplo.com',       'student',      'Bruno Teixeira','1996-11-03'),
  ('carla@exemplo.com',       'student',      'Carla Menezes', '1988-01-27')
) as v(email, role, full_name, birth_date)
join auth.users u on u.email = v.email
on conflict (id) do update
  set role = excluded.role, full_name = excluded.full_name, email = excluded.email;

-- --------------------------------------------------------------- Vínculos --
-- Ana: caso completo (treino + nutrição). Bruno: só treino, e com a OUTRA
-- treinadora — é o que prova o isolamento entre profissionais do mesmo estúdio.
insert into public.assignments (tenant_id, student_id, staff_id, staff_role)
select '11111111-1111-4111-8111-111111111111', s.id, p.id, v.staff_role::public.app_role
from (values
  ('ana@exemplo.com',   'igor@studioguerra.app',   'trainer'),
  ('ana@exemplo.com',   'rafael@studioguerra.app', 'nutritionist'),
  ('bruno@exemplo.com', 'marina@studioguerra.app', 'trainer'),
  ('carla@exemplo.com', 'rafael@studioguerra.app', 'nutritionist')
) as v(student_email, staff_email, staff_role)
join auth.users s on s.email = v.student_email
join auth.users p on p.email = v.staff_email
on conflict (student_id, staff_id, staff_role) do nothing;

-- ------------------------------------------------- Catálogo de exercícios --
-- tenant_id nulo = global, legível por qualquer tenant.
insert into public.exercises (name, muscle_group, equipment)
values
  ('Supino reto', 'peito', 'barra'),
  ('Supino inclinado com halteres', 'peito', 'halteres'),
  ('Crucifixo na máquina', 'peito', 'máquina'),
  ('Tríceps na corda', 'tríceps', 'polia'),
  ('Tríceps testa', 'tríceps', 'barra W'),
  ('Puxada frente', 'costas', 'polia'),
  ('Remada curvada', 'costas', 'barra'),
  ('Remada baixa', 'costas', 'polia'),
  ('Rosca direta', 'bíceps', 'barra W'),
  ('Rosca martelo', 'bíceps', 'halteres'),
  ('Agachamento livre', 'pernas', 'barra'),
  ('Leg press 45°', 'pernas', 'máquina'),
  ('Cadeira extensora', 'pernas', 'máquina'),
  ('Mesa flexora', 'posterior', 'máquina'),
  ('Stiff', 'posterior', 'barra'),
  ('Panturrilha em pé', 'panturrilha', 'máquina'),
  ('Desenvolvimento com halteres', 'ombro', 'halteres'),
  ('Elevação lateral', 'ombro', 'halteres'),
  ('Face pull', 'ombro', 'polia'),
  ('Prancha', 'core', 'peso do corpo'),
  ('Abdominal supra', 'core', 'peso do corpo')
on conflict do nothing;

-- Sem unique no catálogo global, o `on conflict` acima não protege re-execução.
-- Este delete remove duplicatas mantendo a primeira de cada nome.
delete from public.exercises a
using public.exercises b
where a.tenant_id is null and b.tenant_id is null
  and a.name = b.name and a.ctid > b.ctid;

-- ------------------------------------------------------ Planos de treino --
insert into public.workout_plans (id, tenant_id, student_id, created_by, name, goal, starts_on)
select v.plan_id::uuid, '11111111-1111-4111-8111-111111111111', s.id, c.id, v.name, v.goal, current_date - 15
from (values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'ana@exemplo.com',   'igor@studioguerra.app',
   'Hipertrofia — 3x por semana', 'Ganho de massa magra'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bruno@exemplo.com', 'marina@studioguerra.app',
   'Full body iniciante', 'Condicionamento e adaptação')
) as v(plan_id, student_email, creator_email, name, goal)
join auth.users s on s.email = v.student_email
join auth.users c on c.email = v.creator_email
on conflict (id) do nothing;

insert into public.workout_days (id, tenant_id, plan_id, label, name, focus, order_index)
values
  ('bbbbbbbb-0000-4000-8000-00000000000a', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'A', 'Peito e tríceps',  'empurrar',   0),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'B', 'Costas e bíceps',  'puxar',      1),
  ('bbbbbbbb-0000-4000-8000-00000000000c', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'C', 'Pernas e ombro',   'inferiores', 2),
  ('bbbbbbbb-0000-4000-8000-00000000000d', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'A', 'Corpo inteiro A',  'adaptação',  0),
  ('bbbbbbbb-0000-4000-8000-00000000000e', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', 'B', 'Corpo inteiro B',  'adaptação',  1)
on conflict (id) do nothing;

insert into public.workout_day_exercises
  (tenant_id, day_id, exercise_id, order_index, sets, target_reps, target_load_kg, rest_seconds)
select '11111111-1111-4111-8111-111111111111', v.day_id::uuid, e.id,
       v.order_index, v.sets, v.reps, v.load, v.rest
from (values
  -- Ana · A
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'Supino reto',                   0, 4, '8-10',  40,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'Supino inclinado com halteres', 1, 3, '10-12', 14,  75),
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'Crucifixo na máquina',          2, 3, '12-15', 30,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'Tríceps na corda',              3, 3, '12-15', 20,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000a', 'Tríceps testa',                 4, 3, '10-12', 15,  60),
  -- Ana · B
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Puxada frente',                 0, 4, '10-12', 40,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Remada curvada',                1, 4, '8-10',  30,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Remada baixa',                  2, 3, '12',    35,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Rosca direta',                  3, 3, '10-12', 15,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'Rosca martelo',                 4, 3, '12',    10,  60),
  -- Ana · C
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'Agachamento livre',             0, 4, '8-10',  45, 120),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'Leg press 45°',                 1, 4, '12',   120,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'Mesa flexora',                  2, 3, '12-15', 30,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'Panturrilha em pé',             3, 4, '15-20', 60,  45),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'Desenvolvimento com halteres',  4, 3, '10-12', 12,  75),
  ('bbbbbbbb-0000-4000-8000-00000000000c', 'Elevação lateral',              5, 3, '15',     6,  45),
  -- Bruno · A
  ('bbbbbbbb-0000-4000-8000-00000000000d', 'Agachamento livre',             0, 3, '10',    30,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000d', 'Supino reto',                   1, 3, '10',    30,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000d', 'Remada baixa',                  2, 3, '12',    30,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000d', 'Prancha',                       3, 3, '40s', null,  45),
  -- Bruno · B
  ('bbbbbbbb-0000-4000-8000-00000000000e', 'Leg press 45°',                 0, 3, '12',    80,  90),
  ('bbbbbbbb-0000-4000-8000-00000000000e', 'Puxada frente',                 1, 3, '10-12', 30,  75),
  ('bbbbbbbb-0000-4000-8000-00000000000e', 'Desenvolvimento com halteres',  2, 3, '10',    10,  60),
  ('bbbbbbbb-0000-4000-8000-00000000000e', 'Abdominal supra',               3, 3, '15',  null,  45)
) as v(day_id, exercise_name, order_index, sets, reps, load, rest)
join public.exercises e on e.name = v.exercise_name and e.tenant_id is null
where not exists (
  select 1 from public.workout_day_exercises x
  where x.day_id = v.day_id::uuid and x.exercise_id = e.id and x.order_index = v.order_index
);
