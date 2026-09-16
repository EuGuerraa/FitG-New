"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createInvite, revokeInvite } from "@/lib/data/repo";
import type { AppRole } from "@/lib/types";

export type ConviteState = { error?: string; ok?: string };

export async function convidar(
  _prev: ConviteState,
  formData: FormData,
): Promise<ConviteState> {
  const session = await requireSession();
  if (session.profile.role === "student") return { error: "Sem permissão." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "student") as AppRole;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  try {
    await createInvite(session, { email, fullName, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Índice único: já existe convite aberto para este e-mail no estúdio.
    if (message.includes("invites_open_per_email")) {
      return { error: "Já existe um convite aberto para este e-mail." };
    }
    return { error: "Não foi possível criar o convite." };
  }

  revalidatePath("/convites");
  return { ok: email };
}

export async function cancelar(formData: FormData): Promise<void> {
  const session = await requireSession();
  await revokeInvite(session, String(formData.get("inviteId") ?? ""));
  revalidatePath("/convites");
}
