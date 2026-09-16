import { LegalPage, Section } from "../LegalPage";
import { COMPANY } from "../company";

export const metadata = { title: "Slet konto — RacketBuddy" };

export default function SletKontoPage() {
  return (
    <LegalPage draft={false} title="Slet din RacketBuddy-konto" updated="16. september 2026">
      <Section n="1" title="Slet direkte i appen">
        <p>
          Åbn RacketBuddy, gå til <strong>Min profil</strong> og vælg
          <strong> Slet konto permanent</strong>. Du bliver bedt om at bekræfte,
          før kontoen lukkes.
        </p>
      </Section>

      <Section n="2" title="Hvis du ikke kan logge ind">
        <p>
          Send en e-mail fra den adresse, der er knyttet til din konto, til {" "}
          <a className="underline" href={`mailto:${COMPANY.email}?subject=Slet%20min%20RacketBuddy-konto`}>
            {COMPANY.email}
          </a>{" "}
          med emnet “Slet min RacketBuddy-konto”. Vi kan bede dig bekræfte,
          at du ejer kontoen, før vi gennemfører anmodningen.
        </p>
      </Section>

      <Section n="3" title="Hvad der bliver slettet">
        <p>
          Profiloplysninger som navn, e-mail, telefonnummer, område og øvrige
          personlige profiloplysninger fjernes eller anonymiseres. Oplysninger,
          som vi er juridisk forpligtet til at beholde, eksempelvis relevant
          bogføringsmateriale, opbevares kun så længe loven kræver det.
        </p>
        <p>
          Se vores <a className="underline" href="/privatliv">privatlivspolitik</a>
          for mere information om opbevaring og dine rettigheder.
        </p>
      </Section>
    </LegalPage>
  );
}
