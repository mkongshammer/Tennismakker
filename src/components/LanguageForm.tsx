"use client";
// Language switch form. Spanish is applied by rewriting the page's text in the
// browser (SpanishTranslator), and a soft refresh keeps those rewritten text
// nodes, so after saving the choice we reload the page to get clean text in
// the chosen language.
import type { ReactNode } from "react";
import { setSiteLanguage } from "../lib/language-actions";

export function LanguageForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form
      className={className}
      data-no-translate
      action={async (form: FormData) => {
        await setSiteLanguage(form);
        window.location.reload();
      }}
    >
      {children}
    </form>
  );
}
