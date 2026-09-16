import "server-only";
import { redirect } from "next/navigation";
import type { AppRole, Profile, Session, Tenant } from "@/lib/types";
import { getSupabase } from "@/lib/supabase/server";

// =============================================================================
// Sessão
//
// Quem autentica é o Supabase Auth; o cookie é dele. Aqui só resolvemos quem é
// a pessoa: `auth.getUser()` valida o token no servidor (nunca confiar no que
// vem do cookie sem validar) e as duas leituras seguintes passam pelo RLS, que
// só deixa cada um ler o próprio perfil e o próprio tenant.
// =============================================================================

export async function getSession(): Promise<Session | null> {
  const supabase = await getSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name, email, avatar_url, phone, birth_date, is_active, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profileRow || !profileRow.is_active) return null;

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("id, slug, name, brand_color, logo_url, plan, created_at")
    .eq("id", profileRow.tenant_id)
    .maybeSingle();
  if (!tenantRow) return null;

  const profile: Profile = {
    id: profileRow.id,
    tenantId: profileRow.tenant_id,
    role: profileRow.role as AppRole,
    fullName: profileRow.full_name,
    email: profileRow.email ?? user.email ?? "",
    avatarUrl: profileRow.avatar_url,
    phone: profileRow.phone,
    birthDate: profileRow.birth_date,
    isActive: profileRow.is_active,
    createdAt: profileRow.created_at,
  };

  const tenant: Tenant = {
    id: tenantRow.id,
    slug: tenantRow.slug,
    name: tenantRow.name,
    brandColor: tenantRow.brand_color,
    logoUrl: tenantRow.logo_url,
    plan: tenantRow.plan,
    createdAt: tenantRow.created_at,
  };

  return { profile, tenant };
}

/** Exige sessão. Sem ela, volta para o login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/entrar");
  return session;
}

/** Exige sessão com um dos papéis. Papel errado cai na home do papel certo. */
export async function requireRole(...roles: AppRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.profile.role)) redirect(homeFor(session.profile.role));
  return session;
}

export function homeFor(role: AppRole): string {
  switch (role) {
    case "student":
      return "/hoje";
    case "nutritionist":
      return "/nutri";
    default:
      return "/painel";
  }
}
