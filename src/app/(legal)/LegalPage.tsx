import {getPreferences} from '../../lib/preferences';
import {phrase} from '../../lib/phrases';
import React from "react";

/**
 * Fælles ramme om de juridiske sider.
 *
 * Advarslen øverst er med vilje synlig for brugerne. Dokumenterne er udkast
 * skrevet som udgangspunkt for en advokatgennemgang — ikke færdig jura.
 * Fjern <Draft /> når en advokat har godkendt teksten.
 */
export async function LegalPage({
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
  const {locale}=await getPreferences(); const tr=(s:string)=>phrase(s,locale);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-slate/50">{tr("Senest opdateret:")}{updated}</p>

      {draft && (
        <div className="mt-5 rounded-md border-2 border-court bg-court/5 p-4">
          <p className="font-bold text-court-dark">{tr("Udkast — ikke juridisk gennemgået")}</p>
          <p className="mt-1 text-sm">{tr("Dette dokument er et udgangspunkt, som skal gennemgås og tilpasses af en advokat, før platformen tages i brug med rigtige kunder og betalinger. Det er ikke juridisk rådgivning.")}</p>
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
      <div className="space-y-3 text-slate/85">{children}</div>
    </section>
  );
}

/** Felter der skal udfyldes med rigtige oplysninger før brug. */
export function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-court/15 px-1.5 py-0.5 font-mono text-sm text-court-dark">
      [{children}]
    </span>
  );
}
