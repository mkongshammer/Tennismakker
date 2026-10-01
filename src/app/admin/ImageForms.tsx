"use client";import { useWebsiteInternational } from "../../components/InternationalProvider";

import { useFormState } from "react-dom";
import { uploadImage, deleteImage } from "../../lib/actions";
import { imageUrl } from "../../lib/imageUrl";
import { SubmitButton } from "../../components/SubmitButton";

function Uploader({
  kind,
  title,
  hint,
  current





}: {kind: "LOGO" | "HERO" | "PHOTO";title: string;hint: string;current?: string | null;}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(uploadImage, null);

  return (
    <div className="card">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-slate">{hint}</p>

      {current &&
      <img
        src={imageUrl(current)}
        alt=""
        className={
        kind === "LOGO" ?
        "mt-3 h-20 w-20 rounded-xl border border-slate/15 object-contain p-1" :
        "mt-3 aspect-[2/1] w-full rounded-xl object-cover"
        } />

      }

      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          required
          className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:py-2.5 file:font-semibold file:text-chalk" />

        {kind === "PHOTO" &&
        <input
          className="input"
          name="alt"
          placeholder={tr("Kort beskrivelse, fx \u201CBane 1 en sommeraften\u201D")} />

        }
        {state?.error && <p className="text-sm font-semibold text-court">{tr(state.error)}</p>}
        {state?.ok && <p className="text-sm font-semibold text-court">{tr(state.ok)}</p>}
        <SubmitButton className="btn-ghost" pendingText={tr("Uploader\u2026")}>
          {current ? tr("Skift billede") : tr("Upload")}
        </SubmitButton>
      </form>
    </div>);

}

export function ImageForms({
  logoId,
  heroId,
  photos




}: {logoId: string | null;heroId: string | null;photos: {id: string;alt: string | null;}[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Uploader
          kind="HERO"
          title={tr("Forsidebillede")}
          hint={tr("Det f\xF8rste g\xE6ster ser. Tag det udend\xF8rs i dagslys \u2014 helst banerne med folk p\xE5.")}
          current={heroId} />

        <Uploader
          kind="LOGO"
          title={tr("Klublogo")}
          hint={tr("Vises oven p\xE5 forsidebilledet. PNG med gennemsigtig baggrund virker bedst.")}
          current={logoId} />

      </div>

      <Uploader
        kind="PHOTO"
        title={tr("Billeder af anl\xE6gget")}
        hint={tr("Op til otte. Baner, klubhus, omkl\xE6dning \u2014 det g\xE6ster gerne vil se p\xE5 forh\xE5nd.")} />


      {photos.length > 0 &&
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) =>
        <div key={p.id} className="relative">
              <img
            src={imageUrl(p.id)}
            alt={p.alt ?? ""}
            className="aspect-[4/3] w-full rounded-xl object-cover" />

              <form action={deleteImage} className="absolute right-2 top-2">
                <input type="hidden" name="id" value={p.id} />
                <button
              aria-label={tr("Slet billedet")}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/80 text-chalk">

                  ×
                </button>
              </form>
            </div>
        )}
        </div>
      }
    </div>);

}
