import { requireSession } from "@/lib/auth/session";
import { ROLE_LABEL } from "@/lib/types";
import { ProfileForm } from "./ProfileForm";

export default async function PerfilPage() {
  const session = await requireSession();
  const { profile, tenant } = session;

  return (
    <div className="flex flex-col gap-7 md:max-w-[480px]">
      <header className="flex items-center gap-4">
        <span className="display grid h-16 w-16 shrink-0 place-items-center rounded-[18px] border border-edge-soft bg-metal-2 text-[24px] text-ink-2">
          {profile.fullName.charAt(0)}
        </span>
        <div className="min-w-0">
          <h1 className="display truncate text-[30px] leading-none text-ink">
            {profile.fullName}
          </h1>
          <p className="tag mt-1.5 truncate">
            {ROLE_LABEL[profile.role]} · {tenant.name}
          </p>
        </div>
      </header>

      <ProfileForm
        fullName={profile.fullName}
        phone={profile.phone ?? ""}
        birthDate={profile.birthDate ?? ""}
      />

      <section>
        <h2 className="tag">Conta</h2>
        <dl className="mt-1 flex flex-col">
          <Row label="E-mail" value={profile.email} />
          <Row label="Papel" value={ROLE_LABEL[profile.role]} />
          <Row label="Organização" value={tenant.name} />
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-edge-soft py-3.5 last:border-b">
      <dt className="font-mono text-[11.5px] text-ink-4">{label}</dt>
      <dd className="truncate text-[15px] text-ink">{value}</dd>
    </div>
  );
}
