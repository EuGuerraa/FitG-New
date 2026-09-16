"use client";

import { useEffect } from "react";

/**
 * Registra o service worker depois que a página estabiliza. Falhar aqui não
 * pode atrapalhar nada: sem ele a app só deixa de abrir offline.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const registrar = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Modo anônimo, permissão negada, navegador antigo: segue sem offline.
      });
    };

    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });
  }, []);

  return null;
}
