// Opsætning af automatiseringen mod klubbernes egne bookingsystemer.
//
// Til klubber, der ikke kan forlade fx Halbooking — en lang kontrakt, eller
// bare uvilje mod at skifte. Vi logger ind som dem og fører bookingen ind,
// så deres system er opdateret uden at de rører ved noget.
//
// Siden findes, fordi selektorerne skal findes mod en levende side. De kan
// ikke skrives på forhånd.
import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/session";
import { automationConfigured } from "../../../lib/automation";
import { InspectForm } from "./InspectForm";

export const dynamic = "force-dynamic";

export default async function AutomatiseringPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/");

  const [clubs, logins] = await Promise.all([
    db.club.findMany({
      where: { status: "APPROVED" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.clubSystemLogin.findMany({ include: { club: { select: { name: true } } } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">Automatisering</h1>
        <p className="text-slate">
          For klubber der ikke kan forlade deres nuværende bookingsystem. Vi
          logger ind som dem og fører bookingen ind.
        </p>
      </div>

      {!automationConfigured() && (
        <section className="card border-2 border-court/40">
          <h2 className="display text-xl">Servicen er ikke sat op endnu</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate">
            <li>
              Opret en ny service på Render af typen <span className="data">Docker</span>,
              med rodmappen <span className="data">automation</span> i dette repo.
            </li>
            <li>
              Sæt <span className="data">AUTOMATION_SECRET</span> på den nye service
              til en tilfældig streng.
            </li>
            <li>
              Sæt <span className="data">AUTOMATION_URL</span> og{" "}
              <span className="data">AUTOMATION_SECRET</span> på hovedservicen —
              adressen er den nye services interne URL.
            </li>
          </ol>
          <p className="mt-3 text-sm text-slate">
            Servicen skal <span className="font-bold">ikke</span> være offentligt
            tilgængelig. Den logger ind i klubbers bookingsystemer.
          </p>
        </section>
      )}

      {logins.length > 0 && (
        <section className="card">
          <h2 className="display mb-3 text-xl">Klubber med gemt adgang</h2>
          <ul className="space-y-2 text-sm">
            {logins.map((l: any) => (
              <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{l.club.name}</span>
                <span className="data text-slate">{l.baseUrl}</span>
                <span
                  className={
                    l.lastOkAt
                      ? "font-semibold text-court"
                      : l.lastError
                        ? "font-semibold text-court-dark"
                        : "text-slate-light"
                  }
                >
                  {l.lastOkAt
                    ? `virkede sidst ${l.lastOkAt.toLocaleDateString("da-DK")}`
                    : l.lastError
                      ? l.lastError.slice(0, 80)
                      : "aldrig prøvet"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <InspectForm clubs={clubs} />
    </div>
  );
}
