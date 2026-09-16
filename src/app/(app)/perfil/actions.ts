"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { updateOwnProfile } from "@/lib/data/repo";

export type ProfileState = { ok?: boolean; error?: string };

export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await requireSession();

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();

  if (fullName.length < 2) return { error: "Informe seu nome." };

  await updateOwnProfile(session, {
    fullName,
    phone: phone || null,
    birthDate: birthDate || null,
  });

  revalidatePath("/perfil");
  return { ok: true };
}
