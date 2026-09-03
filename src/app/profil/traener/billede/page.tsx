// Trænerens profilbillede.
//
// Billedet vises først på profilen, når superadmin har set det. Det står
// også på siden her, så træneren ikke tror, at uploaden fejlede.
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/session";
import { imageUrl } from "../../../../lib/images";
import { PhotoForm } from "./PhotoForm";

export const dynamic = "force-dynamic";

export default async function BilledePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.coachProfile) redirect("/profil");

  const image = await db.image.findFirst({
    where: { coachProfileId: user.coachProfile.id },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl">Dit billede</h1>
        <p className="text-slate">
          Et billede gør, at folk tør skrive til dig. Det ses igennem, før det
          vises — vi vil ikke have noget upassende på siden.
        </p>
      </div>

      {image && (
        <div className="card flex items-center gap-4">
          <img
            src={imageUrl(image.id)}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
          <div>
            <p className="font-bold">
              {image.approved ? "Vises på din profil" : "Venter på gennemsyn"}
            </p>
            <p className="text-sm text-slate">
              {image.approved
                ? "Send et nyt, hvis du vil skifte det ud. Det nye ses igennem igen."
                : "Typisk inden for en dag. Du kan sende et andet imens."}
            </p>
          </div>
        </div>
      )}

      <PhotoForm />

      <Link href="/profil/traener" className="btn-ghost inline-block">
        Tilbage til profilen
      </Link>
    </div>
  );
}
