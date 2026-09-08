import { rebookNextWeek } from "../lib/actions";
import { getCurrentUser } from "../lib/session";
import { userProfilePhotoId } from "../lib/profile-images";
import { imageUrl } from "../lib/imageUrl";
import { uploadProfilePhoto, deleteProfilePhoto } from "../app/profil/photo-actions";
import { SubmitButton } from "./SubmitButton";

// "Spil igen": gentag en tid, man allerede har spillet.
// Komponenten ligger kun på profilsiden, så profilbilledet bor her sammen
// med de øvrige profilværktøjer og vises også, når der endnu ikke er noget
// at booke igen.

const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

export type Repeatable = {
  bookingId: string;
  what: string;
  startsAt: Date;
  withName: string | null;
};

export async function PlayAgain({ items }: { items: Repeatable[] }) {
  const user = await getCurrentUser();
  const photoId = user ? await userProfilePhotoId(user.id) : null;
  const initials = user?.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("") ?? "RB";

  return (
    <>
      {user && (
        <section>
          <h2 className="display mb-3 text-2xl">Profilbillede</h2>
          <div className="card flex flex-wrap items-center gap-5">
            {photoId ? (
              <img
                src={imageUrl(photoId)}
                alt={`Profilbillede af ${user.name}`}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-ink text-chalk">
                <span className="display text-2xl">{initials}</span>
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="font-bold">Dit profilbillede</p>
              <p className="mt-1 text-sm text-slate/60">
                Billedet bruges på din RacketBuddy-profil. Både spillere og trænere kan vælge et.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={uploadProfilePhoto} className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="text-sm"
                    required
                  />
                  <button className="btn-court text-sm">
                    {photoId ? "Skift billede" : "Tilføj billede"}
                  </button>
                </form>
                {photoId && (
                  <form action={deleteProfilePhoto}>
                    <button className="btn-ghost text-sm">Fjern billede</button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section>
          <h2 className="display mb-1 text-2xl">Spil igen</h2>
          <p className="mb-4 text-sm text-slate">
            Samme bane, samme tid, næste uge.
          </p>

          <ul className="space-y-3">
            {items.map((item) => {
              const day = DAYS[item.startsAt.getDay()];
              const time = `${String(item.startsAt.getHours()).padStart(2, "0")}:${String(
                item.startsAt.getMinutes()
              ).padStart(2, "0")}`;

              return (
                <li
                  key={item.bookingId}
                  className="card flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold">{item.what}</p>
                    <p className="data mt-1 text-sm text-slate">
                      {day} {time}
                    </p>
                    {item.withName && (
                      <p className="mt-1 text-sm text-slate">Sidst med {item.withName}</p>
                    )}
                  </div>
                  <form action={rebookNextWeek}>
                    <input type="hidden" name="bookingId" value={item.bookingId} />
                    <SubmitButton pendingText="Åbner betaling…">Book næste {day}</SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
