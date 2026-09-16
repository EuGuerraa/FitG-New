/**
 * Contas de demonstração, mostradas na tela de login enquanto o produto não
 * tem cadastro aberto. São usuários reais do Supabase Auth — criados pelo
 * `supabase/seed.sql` e pelo script de contas — e não um atalho de código.
 *
 * Some daqui no dia em que existir convite de aluno de verdade.
 */
export const DEMO_ACCOUNTS = [
  { short: "aluna", email: "ana@exemplo.com", role: "Aluna · treino e nutrição", password: "demo1234" },
  { short: "aluno", email: "bruno@exemplo.com", role: "Aluno · só treino", password: "demo1234" },
  { short: "personal", email: "marina@studioguerra.app", role: "Personal trainer", password: "demo1234" },
  { short: "admin", email: "igor@studioguerra.app", role: "Administrador e personal", password: "demo1234" },
  { short: "nutri", email: "rafael@studioguerra.app", role: "Nutricionista", password: "demo1234" },
];
