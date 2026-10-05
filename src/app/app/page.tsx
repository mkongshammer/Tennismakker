import {getPreferences} from '../../lib/preferences';
import {phrase} from '../../lib/phrases';
import Link from "next/link";

export default async function AppPage() {
 const {locale}=await getPreferences(); const tr=(s:string)=>phrase(s,locale);
  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <div className="card px-6 py-10 sm:px-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-court">{tr("RacketBuddy app")}</p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{tr("Mobilappen er på vej")}</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate/70">{tr("Vi arbejder på RacketBuddy til iPhone og Android, så du snart kan finde medspillere, skrive beskeder, booke baner og holde styr på dine aktiviteter direkte fra mobilen.")}</p>
        <p className="mt-5 text-sm text-slate/60">{tr("Indtil da virker hele RacketBuddy direkte i din mobilbrowser.")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="/app/index.html" className="btn-court px-5 py-3">{tr("Prøv app-demoen")}</a>
          <Link href="/spillere" className="btn-court px-5 py-3">{tr("Find medspillere")}</Link>
          <Link href="/" className="btn-ghost px-5 py-3">{tr("Til forsiden")}</Link>
        </div>
      </div>
    </div>
  );
}
