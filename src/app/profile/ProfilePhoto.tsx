"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { UiText } from "../../components/InternationalProvider";
import { Icon } from "../../components/ui";
import { uploadProfilePhoto, deleteProfilePhoto } from "./photo-actions";

// The avatar is the upload control: tap it (or "Change photo"), pick an
// image and it saves straight away. No browser "Choose file" field.
function Avatar({ photoUrl, initials, name }: { photoUrl: string | null; initials: string; name: string }) {
  const { pending } = useFormStatus();
  return (
    <span className="relative block h-24 w-24 shrink-0 sm:h-28 sm:w-28">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="h-full w-full rounded-full object-cover ring-4 ring-white/15" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-court text-3xl font-extrabold tracking-tight text-white ring-4 ring-white/15">{initials}</span>
      )}
      <span className="absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-optic text-ink shadow-lg ring-4 ring-ink transition group-hover:scale-105">
        {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" /> : <Icon name="camera" size={17} strokeWidth={2} />}
      </span>
    </span>
  );
}

export function ProfilePhoto({ photoUrl, initials, name }: { photoUrl: string | null; initials: string; name: string }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <form ref={form} action={uploadProfilePhoto}>
        <label className="group block cursor-pointer rounded-full focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-optic">
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => { if (e.currentTarget.files?.length) form.current?.requestSubmit(); }}
          />
          <Avatar photoUrl={photoUrl} initials={initials} name={name} />
          <span className="sr-only"><UiText text={photoUrl ? "Skift billede" : "Tilføj billede"} /></span>
        </label>
      </form>
      {photoUrl && (
        <form action={deleteProfilePhoto}>
          <button className="text-xs font-semibold text-white/60 underline-offset-2 hover:text-white hover:underline"><UiText text="Fjern billede" /></button>
        </form>
      )}
    </div>
  );
}
