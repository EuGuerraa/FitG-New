"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { WorkoutDay } from "@/lib/types";
import {
  enfileirar,
  enviar,
  guardarPaginaAtual,
  pendentesDaSessao,
} from "@/lib/offline/queue";
import { ElapsedClock } from "./ElapsedClock";
import { RestBar } from "./RestBar";
import { SyncStatus } from "./SyncStatus";

export type RunnerItem = {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  sets: number;
  targetReps: string;
  targetLoadKg: number | null;
  restSeconds: number;
  notes: string | null;
  previous: { setIndex: number; reps: number | null; loadKg: number | null }[];
};

type LoggedSet = { reps: number | null; loadKg: number | null };
const key = (itemId: string, setIndex: number) => `${itemId}:${setIndex}`;

/** Primeiro número de "8-10", "12" ou "40s" — o alvo que já vem preenchido. */
function firstNumber(reps: string): string {
  const match = reps.match(/\d+/);
  return match ? match[0] : "";
}

/** Prancha é "40s", não "40 reps". A unidade sai da própria prescrição. */
const porTempo = (targetReps: string) => /s\s*$/i.test(targetReps.trim());

export function WorkoutRunner({
  tenantId,
  workoutSessionId,
  startedAt,
  day,
  items,
  logged,
}: {
  tenantId: string;
  workoutSessionId: string;
  startedAt: string;
  day: WorkoutDay;
  items: RunnerItem[];
  logged: { dayExerciseId: string; setIndex: number; reps: number | null; loadKg: number | null }[];
}) {
  const [done, setDone] = useState<Record<string, LoggedSet>>(() =>
    Object.fromEntries(
      logged.map((l) => [key(l.dayExerciseId, l.setIndex), { reps: l.reps, loadKg: l.loadKg }]),
    ),
  );
  const [rest, setRest] = useState<{ id: number; seconds: number; next: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const draft = useRef<Record<string, { kg: string; reps: string }>>({});

  // Depois de um refresh sem rede o HTML vem do cache e está atrasado; a fila
  // local é quem sabe a verdade. Guarda também uma cópia da página, para que o
  // próximo refresh offline caia aqui e não na tela de "sem conexão".
  useEffect(() => {
    let vivo = true;
    void guardarPaginaAtual();
    void pendentesDaSessao(workoutSessionId).then((fila) => {
      if (!vivo || fila.length === 0) return;
      setDone((prev) => {
        const next = { ...prev };
        for (const s of fila) next[key(s.dayExerciseId, s.setIndex)] = { reps: s.reps, loadKg: s.loadKg };
        return next;
      });
    });
    return () => {
      vivo = false;
    };
  }, [workoutSessionId]);

  const totalSets = useMemo(() => items.reduce((sum, i) => sum + i.sets, 0), [items]);
  const doneCount = Object.keys(done).length;

  // Valor que aparece no campo: o que foi registrado, senão a prescrição,
  // senão o que o aluno fez da última vez. Função pura — o rascunho digitado
  // vive num ref, lido só dentro dos handlers.
  function suggested(item: RunnerItem, setIndex: number) {
    const saved = done[key(item.id, setIndex)];
    const prev = item.previous.find((p) => p.setIndex === setIndex);
    return {
      kg: String(saved?.loadKg ?? item.targetLoadKg ?? prev?.loadKg ?? "").replace(".", ","),
      reps: String(saved?.reps ?? firstNumber(item.targetReps)),
    };
  }

  function toggle(item: RunnerItem, setIndex: number, fallback: { kg: string; reps: string }) {
    const k = key(item.id, setIndex);

    if (done[k]) {
      setDone((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      void enfileirar({
        kind: "undoSet",
        id: `undo:${workoutSessionId}:${k}`,
        sessionId: workoutSessionId,
        dayExerciseId: item.id,
        setIndex,
      });
      return;
    }

    const value = draft.current[k] ?? fallback;
    const loadKg = value.kg ? Number(value.kg.replace(",", ".")) : null;
    const reps = value.reps ? Number(value.reps) : null;

    setDone((prev) => ({ ...prev, [k]: { reps, loadKg } }));

    const remaining = setIndex < item.sets ? `${item.name} · série ${setIndex + 1}` : "próximo exercício";
    // Id incremental só para remontar a barra a cada série registrada.
    setRest((prev) => ({
      id: (prev?.id ?? 0) + 1,
      seconds: item.restSeconds,
      next: remaining,
    }));

    // Grava local e devolve o controle na hora. A subida é por trás.
    void enfileirar({
      kind: "logSet",
      id: `set:${workoutSessionId}:${k}`,
      tenantId,
      sessionId: workoutSessionId,
      dayExerciseId: item.id,
      exerciseId: item.exerciseId,
      setIndex,
      reps: Number.isFinite(reps) ? reps : null,
      loadKg: Number.isFinite(loadKg) ? loadKg : null,
      targetReps: item.targetReps,
      targetLoadKg: item.targetLoadKg,
    });
  }

  async function encerrar(effort: number | null, agora: Date) {
    await enfileirar({
      kind: "finishWorkout",
      id: `finish:${workoutSessionId}`,
      sessionId: workoutSessionId,
      finishedAt: agora.toISOString(),
      durationSeconds: Math.max(
        0,
        Math.round((agora.getTime() - new Date(startedAt).getTime()) / 1000),
      ),
      perceivedEffort: effort,
    });
    // Uma última tentativa antes de sair da tela; se falhar, a fila resolve.
    await enviar();
    router.push("/treino?concluido=1");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 pb-28 md:max-w-[560px]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="tag text-gold">
            Dia {day.label} · {day.name.toLowerCase()}
          </p>
          <ElapsedClock startedAt={startedAt} />
        </div>
        <button
          type="button"
          onClick={() => setFinishing(true)}
          className="h-10 shrink-0 rounded-[var(--radius-pill)] border border-edge px-4 text-[14px] font-semibold text-ink transition hover:bg-metal"
        >
          Encerrar
        </button>
      </header>

      <section>
        <div className="flex items-baseline justify-between">
          <span className="tag">Progresso</span>
          <span className="font-mono text-[12px] text-gold">
            {doneCount} / {totalSets} séries
          </span>
        </div>
        <div className="mt-2 h-[5px] overflow-hidden rounded-[var(--radius-pill)] bg-metal-2">
          <div
            className="h-full rounded-[var(--radius-pill)] bg-[linear-gradient(90deg,var(--color-ember),var(--color-gold))] transition-[width] duration-300"
            style={{ width: `${totalSets ? (doneCount / totalSets) * 100 : 0}%` }}
          />
        </div>
      </section>

      <SyncStatus />

      <section className="flex flex-col gap-5">
        {items.map((item) => (
          <article key={item.id} className="border-t border-edge-soft pt-4">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-semibold tracking-[-0.005em] text-ink">
                {item.name}
              </h2>
              <span className="shrink-0 font-mono text-[11.5px] whitespace-nowrap text-gold">
                {item.sets}×{item.targetReps}
                {item.targetLoadKg ? ` · ${format(item.targetLoadKg)}kg` : ""}
              </span>
            </header>

            <p className="mt-1 font-mono text-[11px] text-ink-4">
              {item.previous.length > 0
                ? `da última vez · ${item.previous
                    .map((p) => `${p.reps ?? "—"}×${format(p.loadKg)}`)
                    .join(", ")}`
                : `${item.muscleGroup}${item.equipment ? ` · ${item.equipment}` : ""}`}
            </p>

            <ul className="mt-3 flex flex-col gap-1.5">
              {Array.from({ length: item.sets }, (_, i) => i + 1).map((setIndex) => {
                const k = key(item.id, setIndex);
                const isDone = Boolean(done[k]);
                const value = suggested(item, setIndex);
                return (
                  <li
                    key={setIndex}
                    className={`grid grid-cols-[24px_1fr_1fr_40px] items-center gap-2 rounded-[13px] border px-2.5 py-2 transition ${
                      isDone
                        ? "border-gold/50 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-gold)_16%,transparent),color-mix(in_srgb,var(--color-gold)_6%,transparent))]"
                        : "border-edge-soft bg-metal"
                    }`}
                  >
                    <span className="text-center font-mono text-[12.5px] text-ink-4">
                      {setIndex}
                    </span>

                    <NumberCell
                      id={`kg-${k}`}
                      label={`Carga da série ${setIndex} de ${item.name}`}
                      unit="kg"
                      defaultValue={value.kg}
                      onChange={(v) => {
                        draft.current[k] = { ...(draft.current[k] ?? value), kg: v };
                      }}
                    />
                    <NumberCell
                      id={`reps-${k}`}
                      label={`${porTempo(item.targetReps) ? "Tempo" : "Repetições"} da série ${setIndex} de ${item.name}`}
                      unit={porTempo(item.targetReps) ? "seg" : "reps"}
                      defaultValue={value.reps}
                      onChange={(v) => {
                        draft.current[k] = { ...(draft.current[k] ?? value), reps: v };
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => toggle(item, setIndex, value)}
                      aria-pressed={isDone}
                      aria-label={`Registrar série ${setIndex} de ${item.name}`}
                      className={`justify-self-end grid h-[26px] w-[26px] place-items-center rounded-[8px] border transition ${
                        isDone
                          ? "border-gold bg-gold text-gold-ink"
                          : "border-edge text-transparent hover:border-ink-4"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="m5 12.5 4.5 4.5L19 7" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>

      {rest && (
        <RestBar
          key={rest.id}
          seconds={rest.seconds}
          next={rest.next}
          onDone={() => setRest(null)}
          onSkip={() => setRest(null)}
        />
      )}

      {finishing && (
        <FinishPanel
          busy={pending}
          onCancel={() => setFinishing(false)}
          onConfirm={(effort) => {
            startTransition(() => {
              void encerrar(effort, new Date());
            });
          }}
        />
      )}
    </div>
  );
}

function format(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value).replace(".", ",");
}

function NumberCell({
  id,
  label,
  unit,
  defaultValue,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="flex min-w-0 items-baseline gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        defaultValue={defaultValue}
        onChange={(e) => onChange(e.target.value)}
        className="tnum w-[4.5ch] shrink-0 bg-transparent font-mono text-[13.5px] text-ink outline-none focus-visible:text-gold"
      />
      <span className="font-mono text-[11px] text-ink-4">{unit}</span>
    </span>
  );
}

function FinishPanel({
  busy,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: (effort: number | null) => void;
}) {
  const [effort, setEffort] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ground/70 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-t-[26px] border-t border-edge bg-metal-2 px-6 pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <h2 className="display text-[26px] text-ink">Como foi?</h2>
        <p className="mt-1 text-[14.5px] text-ink-3">
          O esforço percebido ajuda o personal a ajustar a carga. Pode pular.
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setEffort(n)}
              aria-pressed={effort === n}
              className={`h-10 w-10 rounded-[12px] border font-mono text-[13px] transition ${
                effort === n
                  ? "border-gold bg-gold text-gold-ink"
                  : "border-edge-soft text-ink-2 hover:border-edge"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(effort)}
            className="molten flex h-14 items-center justify-center rounded-[var(--radius-pill)] text-[16px] font-bold disabled:opacity-60"
          >
            {busy ? "Encerrando…" : "Encerrar treino"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-[var(--radius-pill)] text-[15px] text-ink-3 transition hover:text-ink"
          >
            Voltar ao treino
          </button>
        </div>
      </div>
    </div>
  );
}
