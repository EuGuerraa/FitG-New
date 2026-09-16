"use client";

import { getBrowserSupabase } from "@/lib/supabase/browser";
import { idb } from "./db";

// =============================================================================
// Fila de escrita
//
// A tela nunca espera a rede. Registrar uma série grava na fila local e devolve
// o controle na hora; a subida acontece por trás. Se o sinal cair no meio do
// treino, a fila segura e reenvia sozinha quando voltar.
//
// Reenviar é seguro porque toda operação é idempotente no banco:
//   · série       → upsert por (sessão, exercício, número da série)
//   · desfazer    → delete pelas mesmas chaves
//   · encerrar    → update de uma linha, com valores absolutos
//
// Por isso a fila não precisa de conciliação: basta repetir até dar certo.
// =============================================================================

export type Operacao =
  | {
      kind: "logSet";
      id: string;
      tenantId: string;
      sessionId: string;
      dayExerciseId: string;
      exerciseId: string;
      setIndex: number;
      reps: number | null;
      loadKg: number | null;
      targetReps: string | null;
      targetLoadKg: number | null;
      at: number;
    }
  | {
      kind: "undoSet";
      id: string;
      sessionId: string;
      dayExerciseId: string;
      setIndex: number;
      at: number;
    }
  | {
      kind: "finishWorkout";
      id: string;
      sessionId: string;
      finishedAt: string;
      durationSeconds: number;
      perceivedEffort: number | null;
      at: number;
    };

/**
 * `Omit` aplicado a uma união achata tudo nas chaves comuns. Esta forma
 * distribui sobre cada variante e preserva os campos de cada operação.
 */
type SemCarimbo<T> = T extends unknown ? Omit<T, "at"> : never;

type Ouvinte = (pendentes: number) => void;

const ouvintes = new Set<Ouvinte>();
let enviando = false;

async function pendentes(): Promise<Operacao[]> {
  const todas = (await idb.all<Operacao>()) ?? [];
  return todas.sort((a, b) => a.at - b.at);
}

async function avisar(): Promise<void> {
  const total = (await pendentes()).length;
  for (const ouvinte of ouvintes) ouvinte(total);
}

/** Recebe o número de operações ainda não enviadas. */
export function observarFila(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  void avisar();
  return () => ouvintes.delete(ouvinte);
}

/**
 * Enfileira e tenta enviar. O `id` da operação é estável, então chamar duas
 * vezes para a mesma série substitui em vez de duplicar.
 *
 * O carimbo de hora é posto aqui, não por quem chama: a ordem da fila é
 * assunto da fila.
 */
export async function enfileirar(op: SemCarimbo<Operacao>): Promise<void> {
  await idb.put({ ...op, at: Date.now() } as Operacao);
  await avisar();
  void enviar();
}

/** Aplica uma operação no Supabase. Devolve false só quando vale tentar de novo. */
async function aplicar(op: Operacao): Promise<boolean> {
  const supabase = getBrowserSupabase();

  if (op.kind === "logSet") {
    const { error } = await supabase.from("set_logs").upsert(
      {
        tenant_id: op.tenantId,
        session_id: op.sessionId,
        day_exercise_id: op.dayExerciseId,
        exercise_id: op.exerciseId,
        set_index: op.setIndex,
        reps: op.reps,
        load_kg: op.loadKg,
        target_reps: op.targetReps,
        target_load_kg: op.targetLoadKg,
      },
      { onConflict: "session_id,day_exercise_id,set_index" },
    );
    return trata(error);
  }

  if (op.kind === "undoSet") {
    const { error } = await supabase
      .from("set_logs")
      .delete()
      .eq("session_id", op.sessionId)
      .eq("day_exercise_id", op.dayExerciseId)
      .eq("set_index", op.setIndex);
    return trata(error);
  }

  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: "done",
      finished_at: op.finishedAt,
      duration_seconds: op.durationSeconds,
      perceived_effort: op.perceivedEffort,
    })
    .eq("id", op.sessionId);
  return trata(error);
}

/**
 * Erro de rede volta para a fila; recusa do banco é descartada.
 *
 * Insistir numa escrita que o RLS recusou só encheria a fila para sempre — e
 * seria a app discutindo com a política de autorização, que é justamente quem
 * deve ter a palavra final.
 */
function trata(error: { code?: string; message?: string } | null): boolean {
  if (!error) return true;

  const recusa = error.code && /^(42501|23503|23514|22\d{3}|PGRST)/.test(error.code);
  if (recusa) {
    console.warn("[fila] operação recusada pelo banco, descartando:", error.code, error.message);
    return true;
  }
  return false;
}

/** Tenta esvaziar a fila, em ordem. Para no primeiro erro de rede. */
export async function enviar(): Promise<void> {
  if (enviando) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  enviando = true;
  try {
    for (const op of await pendentes()) {
      let ok = false;
      try {
        ok = await aplicar(op);
      } catch {
        ok = false; // rede caiu no meio: mantém na fila
      }
      if (!ok) break;
      await idb.remove(op.id);
      await avisar();
    }
  } finally {
    enviando = false;
    await avisar();
  }
}

/**
 * Operações ainda não enviadas desta sessão de treino.
 *
 * Serve para a tela se reconstruir depois de um refresh sem rede: o HTML vem do
 * cache e está desatualizado, mas a fila sabe o que o aluno já registrou.
 */
export async function pendentesDaSessao(
  sessionId: string,
): Promise<{ dayExerciseId: string; setIndex: number; reps: number | null; loadKg: number | null }[]> {
  const fila = await pendentes();
  const feitas = new Map<string, { dayExerciseId: string; setIndex: number; reps: number | null; loadKg: number | null }>();

  // Em ordem: um "desfazer" posterior apaga o registro anterior.
  for (const op of fila) {
    if (op.kind === "logSet" && op.sessionId === sessionId) {
      feitas.set(`${op.dayExerciseId}:${op.setIndex}`, {
        dayExerciseId: op.dayExerciseId,
        setIndex: op.setIndex,
        reps: op.reps,
        loadKg: op.loadKg,
      });
    }
    if (op.kind === "undoSet" && op.sessionId === sessionId) {
      feitas.delete(`${op.dayExerciseId}:${op.setIndex}`);
    }
  }
  return [...feitas.values()];
}

/**
 * Guarda uma cópia da página atual no cache do service worker.
 *
 * Sem isto, recarregar a tela do treino sem rede cai na página de "sem
 * conexão" — que não tem JavaScript e, portanto, mata a fila justamente quando
 * ela é mais necessária. O treino em andamento é a única página que a app faz
 * questão de ter guardada.
 */
export async function guardarPaginaAtual(): Promise<void> {
  if (typeof caches === "undefined" || !navigator.onLine) return;
  try {
    const cache = await caches.open("fitg-v1-paginas");
    await cache.add(new Request(window.location.href, { credentials: "include" }));
  } catch {
    // Sem service worker ou sem cota: a fila continua funcionando.
  }
}

/** Liga a fila aos eventos do navegador. Devolve a função de desligar. */
export function iniciarSincronizacao(): () => void {
  const tentar = () => void enviar();

  window.addEventListener("online", tentar);
  document.addEventListener("visibilitychange", tentar);
  // Rede pode voltar sem disparar "online" (troca de torre, wifi ruim).
  const intervalo = window.setInterval(tentar, 20_000);
  tentar();

  return () => {
    window.removeEventListener("online", tentar);
    document.removeEventListener("visibilitychange", tentar);
    window.clearInterval(intervalo);
  };
}
