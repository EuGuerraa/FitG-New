import type { CSSProperties } from "react";
import type { Session } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { Nav, type NavItem } from "./Nav";
import { logout } from "@/app/entrar/actions";

function navFor(session: Session): NavItem[] {
  switch (session.profile.role) {
    case "student":
      return [
        { href: "/hoje", label: "Hoje", icon: "home" },
        { href: "/treino", label: "Treino", icon: "dumbbell" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
    case "nutritionist":
      return [
        { href: "/nutri", label: "Alunos", icon: "leaf" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
    default:
      return [
        { href: "/painel", label: "Alunos", icon: "people" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
  }
}

export function AppShell({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const { profile, tenant } = session;
  // White-label: a cor do tenant vira o acento de toda a subárvore. O gradiente
  // molten e os anéis derivam dela, então um tenant = um tema, sem rebuild.
  const theme = { "--color-gold": tenant.brandColor } as CSSProperties;
  const items = navFor(session);

  return (
    <div style={theme} className="min-h-dvh">
      <header className="safe-top sticky top-0 z-30 border-b border-edge-soft bg-ground/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-5">
          <span className="molten flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]">
            <span className="display text-[13px] leading-none">
              {tenant.name.charAt(0)}
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {tenant.name}
            </p>
            <p className="tag truncate text-[10px]">
              {profile.fullName} · {ROLE_LABEL[profile.role]}
            </p>
          </div>

          <Nav items={items} />

          <form action={logout}>
            <button
              type="submit"
              className="tag rounded-[var(--radius-pill)] px-3 py-2 transition hover:text-ink"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-32 md:pb-14">{children}</main>

      <Nav items={items} floating />
    </div>
  );
}
