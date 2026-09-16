"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { convidar, type ConviteState } from "./actions";
import { BTN, FIELD } from "@/components/ui";

const PAPEIS = [
  { value: "student", label: "Aluno" },
  { value: "trainer", label: "Personal" },
  { value: "nutritionist", label: "Nutricionista" },
];

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${BTN} mt-1.5`}>
      {pending ? "Gerando link…" : "Gerar convite"}
    </button>
  );
}

export function ConviteForm({ podeConvidarEquipe }: { podeConvidarEquipe: boolean }) {
  const [state, action] = useActionState<ConviteState, FormData>(convidar, {});

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <label>
        <span className="mb-1.5 block font-mono text-[11px] text-ink-3">E-mail</span>
        <input
          id="convite-email"
          name="email"
          type="email"
          inputMode="email"
          placeholder="pessoa@exemplo.com"
          className={FIELD}
        />
      </label>

      <label>
        <span className="mb-1.5 block font-mono text-[11px] text-ink-3">
          Nome (opcional)
        </span>
        <input id="convite-nome" name="fullName" placeholder="Como você chama" className={FIELD} />
      </label>

      {podeConvidarEquipe ? (
        <label>
          <span className="mb-1.5 block font-mono text-[11px] text-ink-3">Entra como</span>
          <select id="convite-papel" name="role" defaultValue="student" className={FIELD}>
            {PAPEIS.map((p) => (
              <option key={p.value} value={p.value} className="bg-metal">
                {p.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="role" value="student" />
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-tile)] border border-danger/40 px-4 py-3 text-[14px] text-danger"
        >
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-[var(--radius-tile)] border border-positive/40 px-4 py-3 text-[14px] text-positive">
          Convite criado para {state.ok}. Copie o link abaixo e mande para a pessoa.
        </p>
      )}

      <Enviar />
    </form>
  );
}
