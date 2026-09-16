"use client";

import { useEffect, useState } from "react";
import { iniciarSincronizacao, observarFila, enviar } from "@/lib/offline/queue";

/**
 * Só aparece quando há algo a dizer. Treino com rede boa não ganha um selo de
 * "sincronizado" a cada série — isso seria ruído. O aviso é para o caso em que
 * o aluno precisa saber que nada se perdeu.
 */
export function SyncStatus() {
  const [pendentes, setPendentes] = useState(0);
  // Assume conectado na primeira renderização: o servidor não sabe o estado da
  // rede do aluno, e os ouvintes abaixo corrigem no primeiro evento.
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const marcar = () => setOnline(navigator.onLine);
    if (!navigator.onLine) marcar();
    window.addEventListener("online", marcar);
    window.addEventListener("offline", marcar);

    const pararDeOuvir = observarFila(setPendentes);
    const pararDeSincronizar = iniciarSincronizacao();

    return () => {
      window.removeEventListener("online", marcar);
      window.removeEventListener("offline", marcar);
      pararDeOuvir();
      pararDeSincronizar();
    };
  }, []);

  if (online && pendentes === 0) return null;

  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-[var(--radius-tile)] border px-3.5 py-2.5 ${
        online ? "border-gold/40 text-gold" : "border-edge text-ink-2"
      }`}
    >
      <span
        aria-hidden
        className={`h-[7px] w-[7px] shrink-0 rounded-full ${
          online ? "animate-pulse bg-gold" : "bg-ink-4"
        }`}
      />
      <span className="flex-1 font-mono text-[11.5px] leading-snug">
        {online
          ? `enviando ${pendentes} ${pendentes === 1 ? "registro" : "registros"}…`
          : pendentes > 0
            ? `sem rede · ${pendentes} ${pendentes === 1 ? "registro guardado" : "registros guardados"}`
            : "sem rede · pode treinar, nada se perde"}
      </span>
      {online && pendentes > 0 && (
        <button
          type="button"
          onClick={() => void enviar()}
          className="shrink-0 font-mono text-[11px] underline underline-offset-2"
        >
          tentar agora
        </button>
      )}
    </div>
  );
}
