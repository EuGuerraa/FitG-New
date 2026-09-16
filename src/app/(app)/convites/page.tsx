import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, homeFor } from "@/lib/auth/session";
import { listPendingInvites } from "@/lib/data/repo";
import { ROLE_LABEL } from "@/lib/types";
import { ConviteForm } from "./ConviteForm";
import { LinkConvite } from "./LinkConvite";
import { cancelar } from "./actions";

export default async function ConvitesPage() {
  const session = await requireSession();
  if (session.profile.role === "student") redirect(homeFor(session.profile.role));

  const invites = await listPendingInvites(session);
  const podeConvidarEquipe = session.profile.role === "owner";

  return (
    <div className="flex flex-col gap-7 md:max-w-[520px]">
      <Link href={homeFor(session.profile.role)} className="tag transition hover:text-ink-2">
        ← Voltar
      </Link>

      <header>
        <p className="tag text-gold">{session.tenant.name}</p>
        <h1 className="display display-xl mt-2 text-[42px] leading-[0.88] text-ink">
          CONVIDAR
        </h1>
        <p className="mt-3 max-w-[38ch] text-[15px] leading-snug text-ink-2">
          Gere um link e mande para a pessoa. Ele vale só para o e-mail do convite, por 14
          dias, e uma vez só.
        </p>
      </header>

      <ConviteForm podeConvidarEquipe={podeConvidarEquipe} />

      <section>
        <h2 className="tag">Convites abertos</h2>
        {invites.length === 0 ? (
          <p className="border-t border-edge-soft py-5 text-[15px] text-ink-3">
            Nenhum convite pendente.
          </p>
        ) : (
          <ul className="flex flex-col">
            {invites.map((invite) => (
              <li key={invite.id} className="border-t border-edge-soft py-4 last:border-b">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold tracking-[-0.005em] text-ink">
                      {invite.fullName || invite.email}
                    </p>
                    <p className="truncate font-mono text-[11px] text-ink-4">
                      {ROLE_LABEL[invite.role].toLowerCase()} · expira{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      }).format(new Date(invite.expiresAt))}
                    </p>
                  </div>
                  <form action={cancelar} className="shrink-0">
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <button
                      type="submit"
                      className="rounded-[var(--radius-pill)] border border-edge-soft px-3 py-1.5 font-mono text-[11px] text-ink-3 transition hover:border-danger/50 hover:text-danger"
                    >
                      cancelar
                    </button>
                  </form>
                </div>
                <LinkConvite token={invite.token} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[13.5px] leading-snug text-ink-4">
        {podeConvidarEquipe
          ? "Como administrador, você pode convidar alunos e também profissionais para a equipe."
          : "O aluno convidado por você já entra vinculado a você — não precisa de um segundo passo."}
      </p>
    </div>
  );
}
