"use client";

import { useFormState } from "react-dom";
import { uploadImage, deleteImage } from "../../lib/actions";
import { imageUrl } from "../../lib/imageUrl";

function Uploader({
  kind,
  title,
  hint,
  current,
}: {
  kind: "LOGO" | "HERO" | "PHOTO";
  title: string;
  hint: string;
  current?: string | null;
}) {
  const [state, action] = useFormState(uploadImage, null);

  return (
    <div className="card">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-slate">{hint}</p>

      {current && (
        <img
          src={imageUrl(current)}
          alt=""
          className={
            kind === "LOGO"
              ? "mt-3 h-20 w-20 rounded-xl border border-slate/15 object-contain p-1"
              : "mt-3 aspect-[2/1] w-full rounded-xl object-cover"
          }
        />
      )}

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          required
          className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2.5 file:font-semibold file:text-chalk"
        />
        {kind === "PHOTO" && (
          <input
            className="input"
            name="alt"
            placeholder="Kort beskrivelse, fx “Bane 1 en sommeraften”"
          />
        )}
        {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
        <button className="btn-ghost">
          {current ? "Skift billede" : "Upload"}
        </button>
      </form>
    </div>
  );
}

export function ImageForms({
  logoId,
  heroId,
  photos,
}: {
  logoId: string | null;
  heroId: string | null;
  photos: { id: string; alt: string | null }[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Uploader
          kind="HERO"
          title="Forsidebillede"
          hint="Det første gæster ser. Tag det udendørs i dagslys — helst banerne med folk på."
          current={heroId}
        />
        <Uploader
          kind="LOGO"
          title="Klublogo"
          hint="Vises oven på forsidebilledet. PNG med gennemsigtig baggrund virker bedst."
          current={logoId}
        />
      </div>

      <Uploader
        kind="PHOTO"
        title="Billeder af anlægget"
        hint="Op til otte. Baner, klubhus, omklædning — det gæster gerne vil se på forhånd."
      />

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="relative">
              <img
                src={imageUrl(p.id)}
                alt={p.alt ?? ""}
                className="aspect-[4/3] w-full rounded-xl object-cover"
              />
              <form action={deleteImage} className="absolute right-2 top-2">
                <input type="hidden" name="id" value={p.id} />
                <button
                  aria-label="Slet billedet"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-chalk"
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
