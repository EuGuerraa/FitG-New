"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "dumbbell" | "leaf" | "people" | "user";
};

const ICONS: Record<NavItem["icon"], React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" />,
  dumbbell: <path d="M4 9v6M20 9v6M7 6v12M17 6v12M7 12h10" />,
  leaf: (
    <>
      <path d="M20 4c0 9-5.5 14-11 14a6 6 0 0 1 0-12c4 0 6-2 11-2Z" />
      <path d="M4 21c2.5-5 6-8.5 10.5-11" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.8 20c0-3.2 2.8-5.2 6.2-5.2s6.2 2 6.2 5.2" />
      <path d="M16.5 5.6a3.2 3.2 0 0 1 0 6.3M17.4 14.9c2.2.5 3.8 2.3 3.8 5.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20.5c0-3.7 3.3-6 7.5-6s7.5 2.3 7.5 6" />
    </>
  ),
};

/**
 * Pílula flutuante. No telefone fica presa ao rodapé, sobre o conteúdo que
 * rola; no desktop ela sobe para a barra de topo, mesma forma.
 */
export function Nav({ items, floating }: { items: NavItem[]; floating?: boolean }) {
  const pathname = usePathname();

  // Executando um treino, o rodapé pertence à barra de descanso. A tela vira
  // tarefa: sai a navegação, fica "Encerrar".
  const executando = /^\/treino\/[^/]+$/.test(pathname);
  if (floating && executando) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className={
        floating
          ? "fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
          : "hidden md:block"
      }
    >
      <ul
        className={`mx-auto flex gap-1 rounded-[var(--radius-pill)] p-1.5 ${
          floating
            ? "glass max-w-[430px] shadow-[0_18px_40px_-20px_rgba(0,0,0,.9)] hairline"
            : "bg-metal/60 hairline"
        }`}
      >
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className={floating ? "flex-1" : ""}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-3.5 text-[13.5px] font-semibold tracking-[-0.005em] transition ${
                  active
                    ? "molten"
                    : "text-ink-3 hover:text-ink-2"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-[18px] w-[18px]"
                  aria-hidden
                >
                  {ICONS[item.icon]}
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
