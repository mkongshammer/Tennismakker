import {getPreferences} from '../../../lib/preferences';
import {phrase} from '../../../lib/phrases';
import { LegalPage, Section } from "../LegalPage";
import { COMPANY } from "../company";

export const metadata = { title: "Delete account — RacketBuddy" };

export default async function SletKontoPage() {
  const {locale}=await getPreferences();
  const us=locale==='en-US';
  const tr=(da:string,en:string)=>us?en:phrase(da,locale);

  return (
    <LegalPage draft={false} title={tr("Slet din RacketBuddy-konto","Delete your RacketBuddy account")} updated={tr("16. september 2026","September 16, 2026")} updatedLabel={us?"Last updated: ":undefined}>
      <Section n="1" title={tr("Slet direkte i appen","Delete directly in the app")}>
        <p>{tr("Åbn RacketBuddy, gå til","Open RacketBuddy, go to ")} <strong>{tr("Min profil","My profile")}</strong> {tr("og vælg","and choose")} <strong>{tr("Slet konto permanent","Delete account permanently")}</strong>{tr(". Du bliver bedt om at bekræfte, før kontoen lukkes.",". You will be asked to confirm before the account is closed.")}</p>
      </Section>

      <Section n="2" title={tr("Hvis du ikke kan logge ind","If you cannot log in")}>
        <p>{tr("Send en e-mail fra den adresse, der er knyttet til din konto, til","Send an email from the address associated with your account to")} {" "}
          <a className="underline" href={`mailto:${COMPANY.email}?subject=Delete%20my%20RacketBuddy%20account`}>
            {COMPANY.email}
          </a>{" "}{tr("med emnet “Slet min RacketBuddy-konto”. Vi kan bede dig bekræfte, at du ejer kontoen, før vi gennemfører anmodningen.","with the subject “Delete my RacketBuddy account”. We may ask you to verify ownership of the account before completing the request.")}</p>
      </Section>

      <Section n="3" title={tr("Hvad der bliver slettet","What is deleted")}>
        <p>{tr("Profiloplysninger som navn, e-mail, telefonnummer, område og øvrige personlige profiloplysninger fjernes eller anonymiseres. Oplysninger, som vi er juridisk forpligtet til at beholde, eksempelvis relevant bogføringsmateriale, opbevares kun så længe loven kræver det.","Profile information such as your name, email address, phone number, location, and other personal profile information is removed or anonymized. Information we are legally required to retain, such as relevant accounting records, is kept only for as long as required by law.")}</p>
        <p>{tr("Se vores","See our")} <a className="underline" href="/privatliv">{tr("privatlivspolitik","Privacy Policy")}</a> {tr("for mere information om opbevaring og dine rettigheder.","for more information about retention and your rights.")}</p>
      </Section>
    </LegalPage>
  );
}
