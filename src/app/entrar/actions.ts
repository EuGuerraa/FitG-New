"use server";

import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/data/repo";
import { homeFor } from "@/lib/auth/session";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Preencha e-mail e senha." };

  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Mensagem única de propósito: não revelar se o e-mail existe.
    return { error: "E-mail ou senha incorretos." };
  }

  const profile = await getProfileById(data.user.id);
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Esta conta ainda não está vinculada a um estúdio." };
  }

  redirect(homeFor(profile.role));
}

export async function logout(): Promise<void> {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect("/entrar");
}
