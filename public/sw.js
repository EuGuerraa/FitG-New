// =============================================================================
// FitG — service worker
//
// Faz uma coisa só: manter a app abrível sem rede. Não sincroniza nada — isso é
// da fila em IndexedDB, que sabe reenviar com idempotência. Um service worker
// tentando ser esperto com escrita é fonte clássica de dado duplicado.
//
// Estratégias:
//   · navegação  → rede primeiro, cache como rede de segurança
//   · /_next/static → cache primeiro (o nome do arquivo já carrega a versão)
//   · Supabase e qualquer POST → nunca passam por aqui
// =============================================================================

const VERSAO = "fitg-v1";
const PAGINAS = `${VERSAO}-paginas`;
const ESTATICOS = `${VERSAO}-estaticos`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nomes = await caches.keys();
      await Promise.all(
        nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase passa direto

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const resposta = await fetch(request);
          const cache = await caches.open(PAGINAS);
          cache.put(request, resposta.clone());
          return resposta;
        } catch {
          const cache = await caches.open(PAGINAS);
          const guardada = await cache.match(request);
          if (guardada) return guardada;
          // Sem cópia da página: melhor uma resposta honesta que um erro do
          // navegador. A fila local segue guardando o que o aluno registrar.
          return new Response(
            "<!doctype html><meta charset=utf-8><title>FitG</title>" +
              "<body style='background:#14110E;color:#F6F0E6;font-family:system-ui;" +
              "display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:24px'>" +
              "<div><h1 style='font-size:22px;margin:0 0 8px'>Sem conexão</h1>" +
              "<p style='color:#B7A994;margin:0'>Abra de novo quando o sinal voltar. " +
              "O que você registrou está guardado.</p></div>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
          );
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon-")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ESTATICOS);
        const guardado = await cache.match(request);
        if (guardado) return guardado;
        const resposta = await fetch(request);
        cache.put(request, resposta.clone());
        return resposta;
      })(),
    );
  }
});
