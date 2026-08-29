import React from "react";

/**
 * Fælles ramme om de juridiske sider.
 *
 * Advarslen øverst er med vilje synlig for brugerne. Dokumenterne er udkast
 * skrevet som udgangspunkt for en advokatgennemgang — ikke færdig jura.
 * Fjern <Draft /> når en advokat har godkendt teksten.
 */
export function LegalPage({
  title,
  updated,
  draft = true,
  children,
}: {
  title: string;
  updated: string;
  draft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-net/50">Senest opdateret: {updated}</p>

      {draft && (
        <div className="mt-5 rounded-md border-2 border-grus bg-grus/5 p-4">
          <p className="font-bold text-grus-deep">Udkast — ikke juridisk gennemgået</p>
          <p className="mt-1 text-sm">
            Dette dokument er et udgangspunkt, som skal gennemgås og tilpasses af
            en advokat, før platformen tages i brug med rigtige kunder og
            betalinger. Det er ikke juridisk rådgivning.
          </p>
        </div>
      )}

      <div className="legal mt-8 space-y-6">{children}</div>
    </div>
  );
}

export function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">
        {n}. {title}
      </h2>
      <div className="space-y-3 text-net/85">{children}</div>
    </section>
  );
}

/** Felter der skal udfyldes med rigtige oplysninger før brug. */
export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-grus/15 px-1.5 py-0.5 font-mono text-sm text-grus-deep">
      [{children}]
    </span>
  );
}
