"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth/session";
import type { AppRole } from "@/lib/types";

export type AceiteState = { error?: string };

/**
 * Aceite do convite.
 *
 * A app nunca cria perfil por conta própria: ela autentica a pessoa e chama
 * `accept_invite`, que é quem tem permissão para isso — e que confere, dentro
 * do banco, se o e-mail da conta é o mesmo do convite. Um link interceptado
 * não serve para outra conta.
 */
export async function aceitarConvite(
  _prev: AceiteState,
  formData: FormData,
): Promise<AceiteState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (fullName.length < 2) return { error: "Informe seu nome." };
  if (password.length < 8) return { error: "A senha precisa de pelo menos 8 caracteres." };
  if (password !== confirm) return { error: "As senhas não são iguais." };

  const supabase = await getSupabase();

  const { error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (signUpError) {
    // Conta já existe: pode ser alguém que recebeu o convite depois de já ter
    // sido criado. Tenta entrar com a senha informada.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return {
        error:
          "Já existe uma conta com este e-mail. Entre com a senha dela ou peça um convite novo.",
      };
    }
  }

  const { data, error } = await supabase.rpc("accept_invite", {
    p_token: token,
    p_full_name: fullName,
  });

  if (error) {
    await supabase.auth.signOut();
    return { error: mensagem(error.code) };
  }

  redirect(homeFor((data as AppRole) ?? "student"));
}

function mensagem(code?: string): string {
  switch (code) {
    case "42501":
      return "Este convite é de outro e-mail.";
    case "23505":
      return "Esta conta já pertence a um estúdio.";
    case "22023":
      return "Convite inválido ou expirado. Peça um link novo.";
    default:
      return "Não foi possível aceitar o convite. Tente de novo.";
  }
}
