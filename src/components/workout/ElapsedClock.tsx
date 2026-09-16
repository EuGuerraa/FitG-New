"use client";

import { useEffect, useState } from "react";

/**
 * Relógio do treino. Derivado de `startedAt`, então um refresh ou a app ir
 * para segundo plano não perde o tempo decorrido.
 */
export function ElapsedClock({ startedAt }: { startedAt: string }) {
  const start = new Date(startedAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <p
      className="display display-xl mt-1.5 text-[50px] leading-[0.86] text-ink"
      suppressHydrationWarning
    >
      {mm}:{ss}
    </p>
  );
}
