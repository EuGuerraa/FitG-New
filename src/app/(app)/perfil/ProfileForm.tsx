"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveProfile, type ProfileState } from "./actions";
import { FIELD } from "@/components/ui";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="molten h-12 rounded-[var(--radius-pill)] px-6 text-[15px] font-bold transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? "Salvando…" : "Salvar"}
    </button>
  );
}

export function ProfileForm({
  fullName,
  phone,
  birthDate,
}: {
  fullName: string;
  phone: string;
  birthDate: string;
}) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, {});

  return (
    <form action={action}>
      <h2 className="tag mb-3">Dados pessoais</h2>

      <div className="flex flex-col gap-3">
        <Field name="fullName" label="Nome completo" defaultValue={fullName} />
        <Field name="phone" label="Telefone" defaultValue={phone} type="tel" />
        <Field name="birthDate" label="Nascimento" defaultValue={birthDate} type="date" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Save />
        {state.ok && <span className="text-[14px] text-positive">Salvo.</span>}
        {state.error && <span className="text-[14px] text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] text-ink-3">{label}</span>
      <input id={name} name={name} type={type} defaultValue={defaultValue} className={FIELD} />
    </label>
  );
}
