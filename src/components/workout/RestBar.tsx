"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Descanso não é pop-up: é uma barra que drena no rodapé enquanto o aluno
 * continua vendo as próximas séries. Some sozinha quando zera.
 *
 * O componente é remontado a cada série (o pai troca a `key`), então o fim da
 * contagem é fixado uma vez e tudo deriva do relógio — se a aba dormir, o
 * tempo restante continua certo ao acordar.
 */
export function RestBar({
  seconds,
  next,
  onDone,
  onSkip,
}: {
  seconds: number;
  next: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [end] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());

  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= end) {
        clearInterval(id);
        done.current();
      }
    }, 250);
    return () => clearInterval(id);
  }, [end]);

  const left = Math.max(0, Math.round((end - now) / 1000));
  const pct = seconds > 0 ? (left / seconds) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:px-5">
      <div className="relative mx-auto max-w-[430px] overflow-hidden rounded-t-[22px] border-t border-edge bg-metal-2 px-[18px] pt-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] md:mb-4 md:max-w-[560px] md:rounded-[22px]">
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-ember)_32%,transparent),color-mix(in_srgb,var(--color-gold)_16%,transparent)_72%,transparent)] transition-[width] duration-300 ease-linear"
          style={{ width: `${pct}%` }}
        />

        <div className="relative flex items-center gap-4">
          <span className="display text-[38px] leading-none text-ink" role="timer">
            {String(Math.floor(left / 60)).padStart(2, "0")}:
            {String(left % 60).padStart(2, "0")}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold text-ink">Descanso</span>
            <span className="block truncate font-mono text-[11px] text-ink-3">
              próxima: {next}
            </span>
          </span>

          <button
            type="button"
            onClick={onSkip}
            className="h-[38px] shrink-0 rounded-[var(--radius-pill)] border border-edge px-4 font-mono text-[12px] text-ink-2 transition hover:text-ink"
          >
            pular
          </button>
        </div>
      </div>
    </div>
  );
}
