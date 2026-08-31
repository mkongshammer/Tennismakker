"use client";

// Knap til inde i en <form action={...}>. Viser en spinner, mens
// handlingen kører — vigtigst på de knapper, der kalder Stripe (opsætning
// af udbetalinger, booking), hvor 3-6 sekunders stilhed ellers let føles
// som om siden er gået i stå.
//
// useFormStatus() virker kun for den <form>, komponenten sidder inde i —
// det er derfor den skal være sit eget lille klientkomponent og ikke bare
// en almindelig <button>.

import { useFormStatus } from "react-dom";

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className = "btn-court",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} ${pending ? "cursor-wait opacity-80" : ""}`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner />
          {pendingText ?? "Vent venligst…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
