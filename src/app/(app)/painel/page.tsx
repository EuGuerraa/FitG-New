import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listStudentsWithActivity } from "@/lib/data/repo";
import { Roster } from "@/components/Roster";

export default async function PainelPage() {
  const session = await requireRole("owner", "trainer");
  const entries = await listStudentsWithActivity(session);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const treinaramHoje = entries.filter(
    (e) => e.lastSessionAt && new Date(e.lastSessionAt).getTime() >= hoje.getTime(),
  ).length;

  return (
    <div className="flex flex-col gap-7 md:max-w-[620px]">
      <header>
        <p className="tag text-gold">
          {session.tenant.name} ·{" "}
          {session.profile.role === "owner" ? "administrador" : "personal"}
        </p>
        <h1 className="display display-xl mt-2 text-[46px] leading-[0.88] text-ink">
          SEUS
          <br />
          ALUNOS
        </h1>
      </header>

      <section className="grid grid-cols-2 gap-2.5">
        <Tile label="Ativos" value={entries.length} />
        <Tile label="Treinaram hoje" value={treinaramHoje} hot />
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="tag">Semana · frequência 7 dias</h2>
          <Link
            href="/convites"
            className="font-mono text-[11px] text-gold transition hover:text-gold-hot"
          >
            convidar aluno →
          </Link>
        </div>
        <div className="mt-1.5">
          <Roster
            entries={entries}
            empty={
              session.profile.role === "owner"
                ? "Nenhum aluno cadastrado no estúdio ainda."
                : "Nenhum aluno designado a você ainda."
            }
          />
        </div>
      </section>

      <p className="text-[13.5px] leading-snug text-ink-4">
        {session.profile.role === "owner"
          ? "Como administrador, você enxerga todos os alunos do estúdio."
          : "Você enxerga apenas os alunos designados a você — a regra é do banco, não da tela."}
      </p>
    </div>
  );
}

function Tile({ label, value, hot }: { label: string; value: number; hot?: boolean }) {
  return (
    <div
      className={`rounded-[18px] border p-4 ${
        hot
          ? "border-gold/35 bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-gold)_14%,transparent),color-mix(in_srgb,var(--color-gold)_4%,transparent))]"
          : "border-edge-soft bg-metal"
      }`}
    >
      <p className={`tag ${hot ? "text-gold" : ""}`}>{label}</p>
      <p className={`display mt-1 text-[38px] leading-none ${hot ? "text-gold" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
