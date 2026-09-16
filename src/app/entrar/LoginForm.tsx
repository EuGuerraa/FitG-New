"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { BTN, FIELD } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${BTN} mt-1.5`}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="flex flex-col gap-7">
      <form action={formAction} className="flex flex-col gap-2.5">
        <label>
          <span className="sr-only">E-mail</span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </label>

        <label>
          <span className="sr-only">Senha</span>
          <input
            id="senha"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <SubmitButton />
      </form>

      <div className="border-t border-edge-soft pt-5">
        <p className="tag">Entrar como</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => {
            const selected = email === account.email;
            return (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
                className={`rounded-[var(--radius-pill)] border px-3.5 py-2 font-mono text-[11.5px] transition ${
                  selected
                    ? "border-gold/55 text-gold"
                    : "border-edge-soft text-ink-3 hover:border-edge hover:text-ink-2"
                }`}
              >
                {account.short}
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[11px] text-ink-4">
          senha demo1234 · toque para preencher
        </p>
      </div>
    </div>
  );
}
