import Link from "next/link";
import type { Profile } from "@/lib/types";

export type RosterEntry = {
  student: Profile;
  week: boolean[];
  lastSessionAt: string | null;
  lastDayLabel: string | null;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function since(iso: string | null): string {
  if (!iso) return "sem treino registrado";
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "agora há pouco";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

/**
 * Lista de alunos. As barrinhas de frequência contam o que importa para o
 * personal — quem sumiu — antes de qualquer número.
 */
export function Roster({ entries, empty }: { entries: RosterEntry[]; empty: string }) {
  if (entries.length === 0) {
    return (
      <p className="border-t border-edge-soft py-5 text-[15px] text-ink-3">{empty}</p>
    );
  }

  return (
    <ul className="flex flex-col">
      {entries.map(({ student, week, lastSessionAt, lastDayLabel }) => {
        const inactive = week.every((d) => !d);
        return (
          <li key={student.id} className="border-t border-edge-soft last:border-b">
            <Link
              href={`/alunos/${student.id}`}
              className="grid grid-cols-[42px_1fr_auto] items-center gap-3.5 py-3.5 transition hover:bg-metal/50"
            >
              <span className="display grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-edge-soft bg-metal-2 text-[17px] text-ink-2">
                {initials(student.fullName)}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold tracking-[-0.005em] text-ink">
                  {student.fullName}
                </span>
                <span
                  className={`mt-0.5 block truncate font-mono text-[11px] ${
                    inactive ? "text-ember" : "text-ink-3"
                  }`}
                >
                  {lastDayLabel ? `${lastDayLabel} · ` : ""}
                  {since(lastSessionAt)}
                </span>
              </span>

              <span
                className="flex h-[26px] shrink-0 items-end gap-[3px]"
                role="img"
                aria-label={`${week.filter(Boolean).length} treinos nos últimos 7 dias`}
              >
                {week.map((trained, i) => (
                  <span
                    key={i}
                    className={`block w-[5px] rounded-[2px] ${
                      trained ? "bg-gold" : "bg-metal-3"
                    }`}
                    style={{ height: trained ? `${14 + ((i * 7) % 13)}px` : "6px" }}
                  />
                ))}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
