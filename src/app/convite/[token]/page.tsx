import type { CSSProperties } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase/server";
import { ROLE_LABEL, type InvitePreview } from "@/lib/types";
import { AceiteForm } from "./AceiteForm";

export default async function ConvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // `invite_preview` é pública de propósito e conta quase nada: nome do
  // estúdio, e-mail convidado e papel. Convite inválido, expirado, revogado ou
  // já aceito devolve vazio — sem distinguir os casos, para o link não virar
  // um oráculo de quem tem conta.
  const supabase = await getSupabase();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const row = Array.isArray(data) ? data[0] : null;

  if (!row) {
    return (
      <main className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center px-6">
        <p className="tag text-gold">Convite</p>
        <h1 className="display display-xl mt-3 text-[46px] leading-[0.88] text-ink">
          LINK SEM
          <br />
          VALIDADE
        </h1>
        <p className="mt-4 text-[16px] leading-snug text-ink-2">
          Este convite expirou, já foi usado ou foi cancelado. Peça um link novo a quem
          te convidou.
        </p>
        <Link
          href="/entrar"
          className="mt-8 flex h-14 items-center justify-center rounded-[var(--radius-pill)] border border-edge text-[16px] font-semibold text-ink transition hover:bg-metal"
        >
          Já tenho conta
        </Link>
      </main>
    );
  }

  const invite: InvitePreview = {
    tenantName: row.tenant_name,
    brandColor: row.brand_color,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
  };

  // White-label desde a primeira tela: quem convida é o estúdio, não o FitG.
  const theme = { "--color-gold": invite.brandColor } as CSSProperties;

  return (
    <main
      style={theme}
      className="safe-top safe-bottom mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-6"
    >
      <header className="pt-14 pb-9">
        <p className="tag text-gold">{invite.tenantName}</p>
        <h1 className="display display-xl mt-3 text-[50px] leading-[0.86] text-ink">
          VOCÊ FOI
          <br />
          CONVIDADO.
        </h1>
        <p className="mt-4 max-w-[30ch] text-[16px] leading-snug text-ink-2">
          Crie sua senha e entre como{" "}
          <span className="text-ink">{ROLE_LABEL[invite.role].toLowerCase()}</span> no{" "}
          {invite.tenantName}.
        </p>
      </header>

      <AceiteForm token={token} email={invite.email} fullName={invite.fullName} />

      <footer className="mt-auto pt-10 pb-4">
        <p className="font-mono text-[11px] leading-relaxed text-ink-4">
          Este link vale só para {invite.email}. Entrar com outro e-mail não funciona.
        </p>
      </footer>
    </main>
  );
}
