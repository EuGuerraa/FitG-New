"use client";

import { useMemo, useState } from "react";
import { adicionarExercicio } from "./actions";

export type PickerExercise = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string | null;
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Busca no catálogo. Sem acento e sem caixa: quem monta plano digita "triceps"
 * com a mão na barra, não "tríceps".
 */
export function ExercisePicker({
  exercises,
  studentId,
  dayId,
}: {
  exercises: PickerExercise[];
  studentId: string;
  dayId: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const list = q
      ? exercises.filter(
          (e) =>
            normalize(e.name).includes(q) ||
            normalize(e.muscleGroup).includes(q) ||
            normalize(e.equipment ?? "").includes(q),
        )
      : exercises;
    return list.slice(0, 8);
  }, [exercises, query]);

  return (
    <div>
      <label htmlFor="busca-exercicio" className="tag">
        Adicionar exercício
      </label>
      <input
        id="busca-exercicio"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="buscar por nome, músculo ou equipamento"
        className="mt-2 h-12 w-full rounded-[var(--radius-tile)] border border-edge-soft bg-metal px-4 text-[15px] text-ink placeholder:text-ink-4 outline-none focus:border-gold"
      />

      <ul className="mt-2 flex flex-col">
        {results.map((exercise) => (
          <li key={exercise.id} className="border-t border-edge-soft last:border-b">
            <form action={adicionarExercicio}>
              <input type="hidden" name="studentId" value={studentId} />
              <input type="hidden" name="dayId" value={dayId} />
              <input type="hidden" name="exerciseId" value={exercise.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-metal/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {exercise.name}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-ink-4">
                    {exercise.muscleGroup}
                    {exercise.equipment ? ` · ${exercise.equipment}` : ""}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-gold">+ incluir</span>
              </button>
            </form>
          </li>
        ))}

        {results.length === 0 && (
          <li className="border-t border-edge-soft py-4 font-mono text-[12px] text-ink-4">
            nada encontrado para “{query.trim()}”
          </li>
        )}
      </ul>
    </div>
  );
}
