"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// O mesmo JWT que o servidor usa, agora no navegador: o cookie de sessão do
// Supabase é legível pelo cliente, então as escritas do treino saem daqui
// direto para o Postgres — e continuam passando pelo RLS.
//
// É isto que torna o offline possível: sem intermediário nosso no caminho, a
// escrita pode ser guardada e reenviada sem depender do nosso servidor.
let client: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
