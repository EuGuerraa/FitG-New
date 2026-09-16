"use client";

import { useState } from "react";

/**
 * O link só é montado no navegador: assim funciona em qualquer domínio
 * (local, preview, produção) sem depender de variável de ambiente.
 */
export function LinkConvite({ token }: { token: string }) {
  const [copiado, setCopiado] = useState(false);
  const url = typeof window === "undefined" ? `/convite/${token}` : `${window.location.origin}/convite/${token}`;

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          setCopiado(false);
        }
      }}
      className="mt-2 flex w-full items-center justify-between gap-3 rounded-[12px] border border-edge-soft bg-metal px-3 py-2.5 text-left transition hover:border-gold"
    >
      <span className="truncate font-mono text-[11px] text-ink-3">/convite/{token.slice(0, 12)}…</span>
      <span className="shrink-0 font-mono text-[11px] text-gold">
        {copiado ? "copiado" : "copiar link"}
      </span>
    </button>
  );
}
