import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// =============================================================================
// Cliente do Supabase para o servidor.
//
// Carrega o JWT do usuário a partir dos cookies, então TODA consulta feita por
// ele chega ao Postgres como aquele usuário — e as políticas de RLS se aplicam.
// Não existe cliente com service_role nesta app: se uma consulta precisasse
// contornar o RLS, isso seria sinal de que a política está errada.
// =============================================================================

export async function getSupabase() {
  const jar = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              jar.set(name, value, options);
            }
          } catch {
            // Server Component não pode escrever cookie. A renovação do token
            // acontece no middleware, que pode — aqui o silêncio é correto.
          }
        },
      },
    },
  );
}
