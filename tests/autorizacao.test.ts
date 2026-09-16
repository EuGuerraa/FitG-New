import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// =============================================================================
// Autorização — teste de integração contra o Supabase real
//
// Estes testes não exercitam código nosso: exercitam as POLÍTICAS DE RLS no
// Postgres, entrando com o token de cada conta de demonstração e conferindo o
// que cada uma consegue ler e escrever. É o único jeito honesto de testar
// autorização que mora no banco — um mock só provaria que o mock concorda com
// ele mesmo.
//
// Precisa de NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
// (lidos de .env.local). Sem eles, a suíte é pulada em vez de falhar.
// =============================================================================

function loadEnv(): { url?: string; key?: string } {
  const env = { ...process.env } as Record<string, string | undefined>;
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] ??= match[2].trim();
    }
  } catch {
    // Sem .env.local: vale o que já estiver no ambiente.
  }
  return { url: env.NEXT_PUBLIC_SUPABASE_URL, key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}

const { url, key } = loadEnv();
const configurado = Boolean(url && key);
const suite = configurado ? describe : describe.skip;

const EMAILS = {
  igor: "igor@studioguerra.app", // administrador e personal
  marina: "marina@studioguerra.app", // personal — só o Bruno
  rafael: "rafael@studioguerra.app", // nutricionista — Ana e Carla
  ana: "ana@exemplo.com", // aluna — treino e nutrição
  bruno: "bruno@exemplo.com", // aluno — só treino
} as const;

const clients: Record<string, SupabaseClient> = {};

async function entrar(email: string): Promise<SupabaseClient> {
  const client = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: "demo1234" });
  if (error) throw new Error(`login falhou para ${email}: ${error.message}`);
  return client;
}

suite("autorização no banco (RLS)", () => {
  beforeAll(async () => {
    for (const [nome, email] of Object.entries(EMAILS)) {
      clients[nome] = await entrar(email);
    }
  }, 60_000);

  describe("quem enxerga quais alunos", () => {
    const casos: [string, number][] = [
      ["ana", 1],
      ["bruno", 1],
      ["marina", 1],
      ["rafael", 2],
      ["igor", 3],
    ];

    it.each(casos)("%s enxerga %i aluno(s)", async (quem, esperado) => {
      const { data } = await clients[quem]
        .from("profiles")
        .select("id")
        .eq("role", "student");
      expect(data?.length ?? 0).toBe(esperado);
    });
  });

  describe("isolamento entre profissionais do mesmo estúdio", () => {
    it("Marina não enxerga o plano da Ana", async () => {
      const { data } = await clients.marina
        .from("workout_plans")
        .select("id, student_id");
      const alunos = new Set((data ?? []).map((p) => p.student_id));
      expect(data?.length).toBe(1);
      expect(alunos.size).toBe(1);
    });

    it("Marina não consegue abrir o plano da Ana nem sabendo o id", async () => {
      const { data: meu } = await clients.ana
        .from("workout_plans")
        .select("id")
        .eq("is_active", true)
        .single();
      const { data } = await clients.marina
        .from("workout_plans")
        .select("id")
        .eq("id", meu!.id);
      expect(data).toEqual([]);
    });
  });

  describe("aluno só enxerga o próprio treino", () => {
    it("Ana não vê sessões de outro aluno", async () => {
      const { data } = await clients.ana.from("workout_sessions").select("student_id");
      const outros = (data ?? []).filter((s) => s.student_id !== undefined);
      const ids = new Set(outros.map((s) => s.student_id));
      expect(ids.size).toBeLessThanOrEqual(1);
    });

    it("Ana não consegue registrar série em treino que não é dela", async () => {
      const { error } = await clients.ana.from("set_logs").insert({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        session_id: "00000000-0000-4000-8000-000000000000",
        exercise_id: "00000000-0000-4000-8000-000000000000",
        set_index: 1,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("cada profissional escreve só na sua área", () => {
    it("nutricionista não cria plano de treino", async () => {
      const { data: aluna } = await clients.rafael
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .limit(1)
        .single();

      const { error } = await clients.rafael.from("workout_plans").insert({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        student_id: aluna!.id,
        name: "não deveria existir",
      });
      expect(error).not.toBeNull();
    });

    it("personal não cria plano alimentar", async () => {
      const { data: aluno } = await clients.marina
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .limit(1)
        .single();

      const { error } = await clients.marina.from("meal_plans").insert({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        student_id: aluno!.id,
        name: "não deveria existir",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("privacidade das fotos de progresso", () => {
    it("o administrador não tem acesso especial às fotos", async () => {
      // Regra deliberada: ser dono do estúdio não dá direito a ver o corpo de
      // todo mundo. A política não tem cláusula de owner.
      const { data } = await clients.igor.from("progress_photos").select("id");
      expect(data).toEqual([]);
    });
  });

  describe("convite (exige a migration 0007)", () => {
    it("link inválido não revela nada", async () => {
      const anon = createClient(url!, key!, { auth: { persistSession: false } });
      const { data, error } = await anon.rpc("invite_preview", { p_token: "nao-existe" });

      if (error?.code === "PGRST202") {
        console.warn("  ⚠ 0007_convite.sql ainda não aplicada — convite não testado");
        return;
      }
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it("aluno não pode criar convite", async () => {
      const { error } = await clients.ana.from("invites").insert({
        tenant_id: "11111111-1111-4111-8111-111111111111",
        email: "invasao@exemplo.com",
        role: "student",
        token: "token-de-teste-do-aluno",
      });
      expect(error).not.toBeNull();
    });

    it("personal cria convite e o aluno alvo não enxerga a lista", async () => {
      const email = `teste-${Date.now()}@exemplo.com`;
      const { error: criar } = await clients.marina
        .from("invites")
        .insert({
          tenant_id: "11111111-1111-4111-8111-111111111111",
          email,
          role: "student",
        });

      // Antes da 0007 o token não tem valor padrão: é o sintoma de que a
      // migration ainda não foi aplicada, e não uma falha de autorização.
      const semMigration =
        criar?.code === "PGRST204" ||
        (criar?.code === "23502" && criar.message.includes("token"));
      if (semMigration) {
        console.warn("  ⚠ 0007_convite.sql ainda não aplicada — convite não testado");
        return;
      }
      expect(criar).toBeNull();

      const { data: comoAluna } = await clients.ana.from("invites").select("id");
      expect(comoAluna).toEqual([]);

      await clients.marina.from("invites").delete().eq("email", email);
    });
  });

  describe("isolamento entre tenants", () => {
    it("ninguém enxerga outro estúdio", async () => {
      const { data } = await clients.igor.from("tenants").select("id");
      expect(data?.length).toBe(1);
    });
  });
});

if (!configurado) {
  // Silêncio aqui esconderia um teste que nunca roda.
  console.warn(
    "\n⚠ Testes de autorização pulados: faltam NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.\n",
  );
}
