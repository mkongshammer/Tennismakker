// Klubbens side, når den vises på klubbens eget domæne.
//
// Middleware har omskrevet værtsnavnet til denne sti. Vi slår klubben op og
// renderer den samme side som på /klub/<slug> — samme komponent, ét sted at
// vedligeholde.
//
// Den omdirigerede før til /klub/<slug>. Det betød, at en besøgende på
// klubbens domæne blev sendt videre til racketbuddy.app et sekund efter, og
// klubben havde altså betalt for en hjemmeside, der afleverede deres trafik
// hos os. Nu bliver adressen stående.
import { notFound } from "next/navigation";
import { db } from "../../../lib/db";
import { ClubPage } from "../../../components/ClubPage";

export const dynamic = "force-dynamic";

export default async function DomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ dag?: string; optaget?: string; fejl?: string }>;
}) {
  const [{ host: encodedHost }, query] = await Promise.all([params, searchParams]);
  const host = decodeURIComponent(encodedHost).toLowerCase();

  const club = await db.club.findFirst({
    where: {
      OR: [{ customDomain: host }, { customDomain: host.replace(/^www\./, "") }],
      status: "APPROVED",
    },
    select: { slug: true },
  });

  if (!club) notFound();

  return <ClubPage slug={club.slug} searchParams={query} ownDomain />;
}
