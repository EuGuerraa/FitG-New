"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { aceitarConvite, type AceiteState } from "./actions";
import { BTN, FIELD } from "@/components/ui";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${BTN} mt-1.5`}>
      {pending ? "Criando sua conta…" : "Entrar no estúdio"}
    </button>
  );
}

export function AceiteForm({
  token,
  email,
  fullName,
}: {
  token: string;
  email: string;
  fullName: string | null;
}) {
  const [state, action] = useActionState<AceiteState, FormData>(aceitarConvite, {});

  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />

      <label>
        <span className="mb-1.5 block font-mono text-[11px] text-ink-3">E-mail do convite</span>
        <input
          id="email-convite"
          value={email}
          disabled
          className={`${FIELD} cursor-not-allowed text-ink-3`}
        />
      </label>

      <label>
        <span className="mb-1.5 block font-mono text-[11px] text-ink-3">Seu nome</span>
        <input
          id="nome"
          name="fullName"
          defaultValue={fullName ?? ""}
          autoComplete="name"
          placeholder="Como quer ser chamado"
          className={FIELD}
        />
      </label>

      <label>
        <span className="mb-1.5 block font-mono text-[11px] text-ink-3">Crie uma senha</span>
        <input
          id="senha"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="mínimo 8 caracteres"
          className={FIELD}
        />
      </label>

      <label>
        <span className="mb-1.5 block font-mono text-[11px] text-ink-3">Repita a senha</span>
        <input
          id="senha-2"
          name="confirm"
          type="password"
          autoComplete="new-password"
          className={FIELD}
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="rounded-[var(--radius-tile)] border border-danger/40 px-4 py-3 text-[14px] text-danger"
        >
          {state.error}
        </p>
      )}

      <Enviar />
    </form>
  );
}
