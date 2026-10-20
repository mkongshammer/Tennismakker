import * as platformPricing from "../platform-pricing";
import * as international from "../international";
import * as location from "../profile-location";
import * as phrases from "../phrases";
import * as subscriptionGrace from "../subscription-grace";
import * as returnPath from "../return-path";
import * as cancellationPolicy from "../cancellation-policy";
import * as mailLocale from "../mail-locale";
import * as lessonNotes from "../lesson-notes";
import * as coachFacts from "../coach-facts";
import * as phraseTranslation from "../../../shared/phrase-translation.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

// Execute the actual source with explicit offline dependencies. An unlisted
// import is an error: these regression tests cannot reach DB, email or Stripe.
export function loadIsolatedModule(relative: string, mocks: Record<string, unknown>) {
  const filename = path.resolve(process.cwd(), relative);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", outputText)((name: string) => {
    if (name in mocks) return mocks[name];
    const pure:Record<string,unknown>={"platform-pricing":platformPricing,"international":international,"profile-location":location,"phrases":phrases,"subscription-grace":subscriptionGrace,"return-path":returnPath,"cancellation-policy":cancellationPolicy,"mail-locale":mailLocale,"lesson-notes":lessonNotes,"coach-facts":coachFacts,"phrase-translation.mjs":phraseTranslation};
    const moduleName=name.split("/").at(-1)!;if(moduleName in pure)return pure[moduleName];
    if (!(name in mocks)) throw new Error(`Unmocked dependency: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports;
}
