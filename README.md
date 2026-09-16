# FitG

SaaS/PWA white-label para personal trainers e nutricionistas, com app do aluno.
Next.js 16 · React 19 · TypeScript · Tailwind 4 · Supabase (Auth, Postgres, RLS).

---

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencher com URL e chave anon do Supabase
npm run dev        # http://localhost:3000
npm test           # autorização, contra o banco real
npm run build
npm run typecheck
npm run lint
```

O banco fica no Supabase. Para montar um do zero: aplicar
`supabase/migrations/*.sql` em ordem, criar as contas de demonstração no Auth
(mesmos e-mails da tabela abaixo, senha `demo1234`) e rodar `supabase/seed.sql`,
que liga os perfis às contas pelo e-mail.

Contas de demonstração (senha `demo1234` em todas) aparecem na própria tela de login:

| E-mail | Papel | Enxerga |
|---|---|---|
| igor@studioguerra.app | Administrador (owner) | todos os alunos do tenant |
| marina@studioguerra.app | Personal trainer | só Bruno |
| rafael@studioguerra.app | Nutricionista | Ana e Carla |
| ana@exemplo.com | Aluna | só a si mesma (equipe: Igor + Rafael) |
| bruno@exemplo.com | Aluno | só a si mesmo |

---

## Arquitetura

### Multi-tenant

Cada personal/estúdio é um **tenant**. Todo registro carrega `tenant_id`. Dentro do
tenant, o **papel** (`owner` / `trainer` / `nutritionist` / `student`) e os **vínculos**
(`assignments`) decidem o que cada um enxerga:

- **aluno** → só os próprios dados e a equipe designada a ele;
- **personal / nutricionista** → só os alunos com vínculo ativo com ele;
- **owner** → tudo dentro do seu tenant, nada fora dele.

O white-label é o `brandColor` do tenant, injetado como `--color-brand` no
`AppShell`. Um tenant, um tema, sem rebuild.

### Onde mora a autorização

Num lugar só: as políticas **RLS** no Postgres. Toda consulta sai do servidor com o
JWT do usuário, então é o banco que decide o que cada um enxerga. Uma leitura sem
permissão volta vazia; uma escrita indevida é recusada.

Não existe cliente com `service_role` nesta app. Se alguma consulta precisasse
contornar o RLS, o erro estaria na política, não no código.

O frontend **nunca** decide autorização — no máximo esconde o que o banco já
recusaria. `src/app/(app)/alunos/[id]/page.tsx` mostra o caminho negado.

Os testes em `tests/` entram com o token de cada conta e conferem o que ela consegue
ler e escrever. É teste de integração de propósito: mock de autorização só prova que
o mock concorda com ele mesmo.

### Camadas

```
src/
  app/
    entrar/                 login (server action + cookie httpOnly assinado)
    (app)/                  tudo que exige sessão
      layout.tsx            requireSession() + AppShell
      hoje/                 home do aluno
      painel/               home do owner/personal
      nutri/                home do nutricionista
      alunos/[id]/          ficha do aluno (staff) e editor de plano
      convites/             gerar e cancelar convites
      perfil/               dados próprios
    convite/[token]/        entrada pública de quem foi convidado
  components/               AppShell, Nav, StudentList
  lib/
    types.ts                modelo de domínio (espelha o schema)
    demo.ts                 contas de demonstração da tela de login
    auth/session.ts         resolve quem é o usuário a partir do Supabase Auth
    supabase/server.ts      cliente com o JWT do usuário (nunca service_role)
    data/repo.ts            consultas; a autorização é do banco
  middleware.ts             renova o token a cada navegação
supabase/
  migrations/               schema e políticas, em ordem
  seed.sql                  dados de demonstração, re-executável
tests/                      autorização, contra o Supabase real (vitest)
```

### Migrations

| Arquivo | O que traz |
|---|---|
| `0001_foundation.sql` | tenants, perfis, vínculos, convites |
| `0002_treino.sql` | exercícios, planos, dias, prescrição, sessões, séries |
| `0003_nutricao.sql` | alimentos, plano alimentar, refeições, registro, água |
| `0004_avaliacao.sql` | avaliações, medidas, fotos de progresso |
| `0005_cobranca.sql` | planos, assinaturas, faturas |
| `0006_offline.sql` | carimbos, índices de sync, gatilho de sessão única |
| `0007_convite.sql` | token, vínculo automático e as duas funções do convite |

Duas regras não óbvias: **o administrador não vê fotos de progresso** (só o aluno e,
se ele compartilhar, a equipe designada), e **nutricionista não escreve treino nem
personal escreve dieta** — cada um lê o do outro para contexto.

### Entrada do aluno

Quem está chegando ainda não tem tenant nem papel, então nenhuma política de RLS pode
autorizá-lo a criar o próprio perfil. Em vez de dar `service_role` à aplicação, o passo
privilegiado mora no banco, em duas funções `SECURITY DEFINER` de escopo mínimo:

- `invite_preview(token)` — pública. Devolve nome do estúdio, e-mail e papel, e nada
  mais. Convite inválido, expirado, revogado ou já usado devolve vazio, sem distinguir
  os casos: o link não pode virar oráculo de quem tem conta.
- `accept_invite(token, nome)` — exige sessão **e** que o e-mail da conta autenticada
  seja o mesmo do convite. Um link interceptado não serve para outra conta.

A confirmação de e-mail do Supabase fica desligada de propósito: o link do convite já
prova a posse do endereço, e o aceite confere isso de novo no banco.

---

## PWA

`src/app/manifest.ts` + ícones em `public/`. Standalone, portrait, `viewport-fit=cover`
e utilitários `safe-top` / `safe-bottom` para o iPhone. Falta ainda o service worker
de offline — entra junto com o treino, que é a tela que precisa funcionar sem rede.

## Design — direção "Forja"

Metal quente e ouro em brasa. Um app de treino é um caderno de números (carga,
repetição, tempo), então o número é o desenho.

- **Cor**: chão `#14110E` — carvão amarronzado, não preto azulado; metal em camadas;
  ouro `#E8A33D` e ember `#C4552A` como calor. Tokens em `src/app/globals.css`.
  O `brandColor` do tenant sobrescreve `--color-gold` no `AppShell`: um tenant, um
  tema, sem rebuild.
- **Tipo**: Bricolage Grotesque (display, com eixo óptico — `.display` / `.display-xl`),
  Schibsted Grotesk (texto), Kode Mono (rótulo, carga, cronômetro). Carregadas pelo
  `next/font`, sem requisição a terceiros.
- **Regra de composição**: nem tudo é card. Moldura, fundo e raio são gastos só no que
  se toca; listas são pauta com fio de 1px (`Ledger`). A borda do herói é uma onda
  (`Wave`), não um `border-radius`.
- **Motivo único**: `.molten` (ação) e `.molten-hero` (herói) são os dois lugares onde
  o gradiente aparece.

A direção foi aprovada num estudo à parte — `design/forja.html`, que também carrega os
dois pares de tipografia descartados.

## Estado atual

Pronto:

- **Fundação** — tenant, papéis, vínculos, RLS, sessão, roteamento por papel.
- **Treino** — biblioteca de exercícios, plano com dias A/B/C, prescrição por
  exercício, execução com registro de série, timer de descanso e histórico. Migration
  `0002_treino.sql` com as políticas correspondentes.
- **Entrada do aluno** — convite com link de uso único, aceite com criação de conta e
  vínculo automático a quem convidou.
- **Telas** — login, convite, hoje, plano, execução, editor de plano, painel do
  personal, painel do nutricionista, ficha do aluno, perfil.
- PWA instalável, 16 testes de autorização, build/lint/typecheck limpos.

A seguir: fila offline no treino, avaliação física, nutrição e cobrança.
