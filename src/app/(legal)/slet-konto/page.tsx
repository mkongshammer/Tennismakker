import {getPreferences} from '../../../lib/preferences';
import {phrase} from '../../../lib/phrases';
import { LegalPage, Section } from "../LegalPage";
import { COMPANY } from "../company";

export const metadata = { title: "Slet konto — RacketBuddy" };

export default async function SletKontoPage() {
 const {locale}=await getPreferences(); const tr=(s:string)=>` ${phrase(s,locale)} `;
  return (
    <LegalPage draft={false} title={tr("Slet din RacketBuddy-konto")} updated={tr("16. september 2026")}>
      <Section n="1" title={tr("Slet direkte i appen")}>
        <p>{tr("Åbn RacketBuddy, gå til")}<strong>{tr("Min profil")}</strong>{tr("og vælg")}<strong>{tr("Slet konto permanent")}</strong>{tr(". Du bliver bedt om at bekræfte, før kontoen lukkes.")}</p>
      </Section>

      <Section n="2" title={tr("Hvis du ikke kan logge ind")}>
        <p>{tr("Send en e-mail fra den adresse, der er knyttet til din konto, til")}{" "}
          <a className="underline" href={`mailto:${COMPANY.email}?subject=Slet%20min%20RacketBuddy-konto`}>
            {COMPANY.email}
          </a>{" "}{tr("med emnet “Slet min RacketBuddy-konto”. Vi kan bede dig bekræfte, at du ejer kontoen, før vi gennemfører anmodningen.")}</p>
      </Section>

      <Section n="3" title={tr("Hvad der bliver slettet")}>
        <p>{tr("Profiloplysninger som navn, e-mail, telefonnummer, område og øvrige personlige profiloplysninger fjernes eller anonymiseres. Oplysninger, som vi er juridisk forpligtet til at beholde, eksempelvis relevant bogføringsmateriale, opbevares kun så længe loven kræver det.")}</p>
        <p>{tr("Se vores")}<a className="underline" href="/privatliv">{tr("privatlivspolitik")}</a>{tr("for mere information om opbevaring og dine rettigheder.")}</p>
      </Section>
    </LegalPage>
  );
}
