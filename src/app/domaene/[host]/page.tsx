// Klubbens side, når den vises på klubbens eget domæne.
//
// Middleware har omskrevet værtsnavnet til denne sti. Vi slår klubben op
// og viser præcis den samme side som på /klub/[slug] — samme kode, ét sted
// at vedligeholde.
import { notFound, redirect } from "next/navigation";
import { db } from "../../../lib/db";

export const dynamic = "force-dynamic";

export default async function DomainPage({
  params,
}: {
  params: { host: string };
}) {
  const host = decodeURIComponent(params.host).toLowerCase();

  const club = await db.club.findFirst({
    where: {
      OR: [{ customDomain: host }, { customDomain: host.replace(/^www\./, "") }],
      status: "APPROVED",
    },
  });

  if (!club) notFound();
  redirect(`/klub/${club.slug}`);
}
