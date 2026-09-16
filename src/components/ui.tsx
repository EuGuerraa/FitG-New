import Link from "next/link";
import type { ReactNode } from "react";

// =============================================================================
// Peças da direção "Forja"
//
// A regra que segura o visual: nem tudo é card. Moldura, fundo e raio são
// gastos só no que se toca. Listas são pauta com fio de 1px.
// =============================================================================

/** Classe do botão principal. Ação = ouro em brasa. */
export const BTN =
  "molten flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] " +
  "text-[16px] font-bold tracking-[-0.005em] transition active:scale-[0.99] " +
  "shadow-[0_10px_26px_-14px_color-mix(in_srgb,var(--color-gold)_90%,transparent)] " +
  "disabled:opacity-60";

/** Botão secundário: só contorno, nenhum calor. */
export const BTN_GHOST =
  "flex h-14 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] " +
  "border border-edge text-[16px] font-semibold text-ink transition " +
  "hover:bg-metal active:scale-[0.99]";

export const FIELD =
  "h-14 w-full rounded-[var(--radius-tile)] border border-edge-soft bg-metal px-[18px] " +
  "text-[16px] text-ink placeholder:text-ink-4 outline-none transition " +
  "focus:border-gold";

export function ScreenTitle({
  eyebrow,
  children,
  size = "md",
}: {
  eyebrow?: ReactNode;
  children: ReactNode;
  size?: "md" | "xl";
}) {
  return (
    <div>
      {eyebrow && <p className="tag">{eyebrow}</p>}
      <h1
        className={`display mt-2 text-ink ${
          size === "xl"
            ? "display-xl text-[58px] leading-[0.88]"
            : "text-[42px] leading-[0.9]"
        }`}
      >
        {children}
      </h1>
    </div>
  );
}

/** Onda: a borda do herói é desenho, não caixa. */
export function Wave({ fill = "var(--color-ground)" }: { fill?: string }) {
  return (
    <svg
      viewBox="0 0 390 46"
      preserveAspectRatio="none"
      className="block h-[46px] w-full"
      aria-hidden
    >
      <path
        d="M0 26 C 58 4, 108 46, 170 30 C 232 14, 286 42, 330 30 C 356 23, 374 14, 390 8 L390 46 L0 46 Z"
        fill={fill}
      />
    </svg>
  );
}

// --------------------------------------------------------------------- Pauta

export function Ledger({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function LedgerRow({
  glyph,
  name,
  meta,
  tail,
  hot,
  href,
}: {
  glyph?: string;
  name: ReactNode;
  meta?: ReactNode;
  tail?: ReactNode;
  hot?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      {glyph !== undefined && (
        <span
          className={`display text-[56px] leading-[0.78] ${
            hot ? "text-gold" : "text-edge"
          }`}
        >
          {glyph}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[17px] font-semibold tracking-[-0.005em] text-ink">
          {name}
        </span>
        {meta && (
          <span className="mt-0.5 block truncate font-mono text-[11.5px] text-ink-3">
            {meta}
          </span>
        )}
      </span>
      {tail && (
        <span
          className={`shrink-0 text-right font-mono text-[11.5px] ${
            hot ? "text-gold" : "text-ink-4"
          }`}
        >
          {tail}
        </span>
      )}
    </>
  );

  const cls = `grid items-center gap-3.5 border-t border-edge-soft py-4 last:border-b ${
    glyph !== undefined ? "grid-cols-[58px_1fr_auto]" : "grid-cols-[1fr_auto]"
  } ${href ? "transition hover:bg-metal/50" : ""}`;

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

// -------------------------------------------------------------------- Anéis

/**
 * Três anéis concêntricos: treino, carga movida, refeições. Cada um recebe a
 * fração já calculada (0–1); nada de cálculo dentro do desenho.
 */
export function Rings({
  train,
  load,
  meal,
  size = 112,
}: {
  train: number;
  load: number;
  meal: number;
  size?: number;
}) {
  const radii = [48, 35, 22];
  const colors = ["var(--color-ring-train)", "var(--color-ring-load)", "var(--color-ring-meal)"];
  const values = [train, load, meal];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 112 112"
      role="img"
      aria-label="Progresso da semana em treino, carga movida e refeições"
      className="shrink-0"
    >
      {radii.map((r, i) => {
        const circumference = 2 * Math.PI * r;
        const pct = Math.max(0, Math.min(1, values[i]));
        return (
          <g key={r}>
            <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-edge-soft)" strokeWidth="10" />
            <circle
              cx="56"
              cy="56"
              r={r}
              fill="none"
              stroke={colors[i]}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - pct)}
              transform="rotate(-90 56 56)"
            />
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------- Vazios

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-edge-soft bg-metal p-8 text-center">
      <h2 className="display text-[22px] text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] leading-snug text-ink-3">{hint}</p>
    </div>
  );
}
