// Trænerbilleder, der venter på gennemsyn.
//
// Den eneste moderering, der findes, er et menneske, der kigger. Med under
// tyve trænere er det hurtigere og mere pålideligt end en tjeneste — og
// det er dig, der hæfter for, hvad der står på siden.
import { db } from "../../lib/db";
import { imageUrl } from "../../lib/imageUrl";
import { reviewCoachPhoto } from "../profil/traener/billede/actions";
import { SubmitButton } from "../../components/SubmitButton";

export async function CoachPhotos() {
  const pending = await db.image.findMany({
    where: { kind: "COACH", approved: false },
    include: { coachProfile: { include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (pending.length === 0) return null;

  return (
    <section className="card border-2 border-court/30">
      <h2 className="display text-2xl">
        {pending.length === 1
          ? "1 trænerbillede venter på gennemsyn"
          : `${pending.length} trænerbilleder venter på gennemsyn`}
      </h2>
      <p className="mt-1 text-sm text-slate">
        Godkend, hvis det er et almindeligt portræt af personen. Afvis alt
        andet — et afvist billede slettes.
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {pending.map((img: any) => (
          <li key={img.id} className="flex items-center gap-4 rounded-xl border border-slate/15 p-3">
            <img
              src={imageUrl(img.id)}
              alt=""
              className="h-24 w-24 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{img.coachProfile?.user.name}</p>
              <p className="truncate text-xs text-slate">{img.coachProfile?.user.email}</p>
              <div className="mt-2 flex gap-2">
                <form action={reviewCoachPhoto}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <input type="hidden" name="decision" value="approve" />
                  <SubmitButton className="btn-court px-3 py-1.5 text-sm" pendingText="…">
                    Godkend
                  </SubmitButton>
                </form>
                <form action={reviewCoachPhoto}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <SubmitButton className="btn-ghost px-3 py-1.5 text-sm" pendingText="…">
                    Afvis
                  </SubmitButton>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
