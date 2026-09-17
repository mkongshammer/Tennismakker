import { LegalPage, Section } from "../LegalPage";
import { COMPANY, EU_REPRESENTATIVE } from "../company";

export const metadata = { title: "Privatlivspolitik — RacketBuddy" };

export default function PrivatlivPage() {
  return (
    <LegalPage draft={false} title="Privatlivspolitik" updated="17. september 2026">
      <Section n="1" title="Dataansvarlig">
        <p>
          {COMPANY.name}, {COMPANY.registration}, med adresse{" "}
          {COMPANY.address}, er dataansvarlig for de oplysninger, du giver os,
          når du opretter en profil og bruger platformen.
        </p>
        <p>
          Har du spørgsmål til behandlingen af dine oplysninger, kan du skrive
          til {COMPANY.email}.
        </p>
        <p>
          Fordi selskabet er registreret uden for EU, har vi udpeget en
          repræsentant i EU efter databeskyttelsesforordningens artikel 27.
          Bor du i EU, kan du henvende dig direkte til{" "}
          {EU_REPRESENTATIVE.name}, {EU_REPRESENTATIVE.country}, på{" "}
          {EU_REPRESENTATIVE.email}. Du kan bruge den kontakt til alt, der
          handler om dine oplysninger — du behøver ikke skrive til USA.
        </p>
        <p>
          Bruger du platformen som medlem af en klub, er klubben selvstændigt
          dataansvarlig for de oplysninger, klubben selv behandler om dig. Vi er
          i den sammenhæng databehandler for klubben.
        </p>
      </Section>

      <Section n="2" title="Hvilke oplysninger vi behandler">
        <p>Vi behandler følgende om dig, når det er relevant for din brug:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Navn, e-mail og eventuelt telefonnummer</li>
          <li>Dit spillerniveau, valgte region/område og sportsgrene</li>
          <li>Dine bookinger og betalingshistorik</li>
          <li>Profiltekst, spilleopslag, beskeder og anmeldelser, du selv opretter</li>
          <li>Rapporter om brugerindhold og oplysninger om brugere, du har blokeret</li>
          <li>Tekniske oplysninger som IP-adresse og tidspunkter for login</li>
        </ul>
        <p>
          Mobilappen anmoder ikke om din præcise GPS-position for at finde
          medspillere; du vælger selv en region eller et område.
        </p>
        <p>
          Vi opbevarer ikke dine kortoplysninger. Betalinger håndteres af{" "}
          Stripe, Inc., som behandler betalingsdata i forbindelse med checkout.
        </p>
      </Section>

      <Section n="3" title="Hvad vi bruger oplysningerne til">
        <p>
          <strong>For at opfylde aftalen med dig</strong> (databeskyttelsesforordningens
          artikel 6, stk. 1, litra b): at oprette din profil, gennemføre
          bookinger, sende kvitteringer og gøre det muligt for spillere at finde
          og kommunikere med hinanden.
        </p>
        <p>
          <strong>For at overholde loven</strong> (artikel 6, stk. 1, litra c):
          blandt andet at opbevare regnskabsmateriale i den periode, loven kræver.
        </p>
        <p>
          <strong>Efter en interesseafvejning</strong> (artikel 6, stk. 1, litra f):
          at drive og sikre platformen, behandle rapporter, håndhæve blokeringer,
          forhindre misbrug og forbedre tjenesten. Vi vurderer løbende denne
          behandling i forhold til dine rettigheder og interesser.
        </p>
      </Section>

      <Section n="4" title="Hvem oplysningerne deles med">
        <p>
          Booker du en bane, deler vi de oplysninger, der er nødvendige for
          bookingen, med klubben, så den kan levere ydelsen. Booker du en
          trænertime, deles nødvendige bookingoplysninger tilsvarende med træneren.
        </p>
        <p>
          Når du får kontakt med en anden spiller via makkerfunktionen, kan I
          skrive sammen inde i RacketBuddy. Din e-mail og dit telefonnummer
          udleveres ikke automatisk til den anden spiller; du bestemmer selv, om
          du vil dele yderligere kontaktoplysninger i en besked.
        </p>
        <p>
          Vi bruger leverandører til blandt andet hosting, betaling og e-mail,
          herunder Render Services, Inc., Stripe, Inc. og Resend, Inc. De
          behandler kun oplysninger i det omfang, det er nødvendigt for deres
          del af tjenesten og efter de relevante aftaler.
        </p>
        <p>
          Vi sælger ikke dine oplysninger og bruger dem ikke til reklamer fra
          tredjeparter.
        </p>
      </Section>

      <Section n="5" title="Overførsel til lande uden for EU/EØS">
        <p>
          Vores primære servere og database er placeret i Frankfurt. Nogle af
          vores leverandører og selskabet bag RacketBuddy er amerikanske, og der
          kan derfor ske overførsel eller adgang fra USA. Når personoplysninger
          overføres uden for EU/EØS, bruger vi et gyldigt overførselsgrundlag,
          hvor det er påkrævet, eksempelvis EU-Kommissionens
          standardkontraktbestemmelser eller en relevant adequacy-ordning.
        </p>
      </Section>

      <Section n="6" title="Hvor længe vi gemmer oplysningerne">
        <p>
          Din profil gemmes, så længe du har en konto. Når du sletter din konto,
          anonymiserer eller fjerner vi de profiloplysninger, der ikke skal
          bevares af juridiske eller dokumentationsmæssige grunde.
        </p>
        <p>
          Regnskabs- og betalingsoplysninger gemmes i den periode, som gældende
          bogføringsregler kræver. Lukkede makkeropslag slettes efter vores
          gældende sletterutine.
        </p>
        <p>
          Moderationsrapporter opbevares kun så længe, det er nødvendigt for at
          håndtere sikkerhed, misbrug og eventuelle tvister. Oplysninger om dine
          blokeringer fjernes, når du fjerner blokeringen eller sletter kontoen.
        </p>
      </Section>

      <Section n="7" title="Børn og unge">
        <p>
          RacketBuddy-konti er beregnet til personer på 18 år og derover. Er du
          under 18, må du ikke oprette din egen profil. En forælder eller værge
          kan foretage en booking fra sin egen konto, hvor det er relevant.
        </p>
        <p>
          Bliver vi opmærksomme på, at en person under 18 har oprettet en konto
          i strid med reglerne, tager vi de nødvendige skridt til at lukke eller
          rette kontoen. Kontakt os på {COMPANY.email}, hvis du mener, det er
          tilfældet.
        </p>
      </Section>

      <Section n="8" title="Dine rettigheder">
        <p>Du har ret til at:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>få indsigt i, hvilke oplysninger vi har om dig</li>
          <li>få rettet forkerte oplysninger</li>
          <li>få slettet oplysninger, når vi ikke længere har grund til at gemme dem</li>
          <li>få begrænset behandlingen</li>
          <li>få dine oplysninger udleveret i et maskinlæsbart format, når reglerne giver ret til det</li>
          <li>gøre indsigelse mod behandling, der sker efter en interesseafvejning</li>
        </ul>
        <p>
          Skriv til {COMPANY.email}, hvis du vil bruge dine rettigheder. Du kan
          også slette din konto direkte under Min profil i mobilappen.
        </p>
        <p>
          Er du utilfreds med vores behandling, kan du klage til Datatilsynet,
          Carl Jacobsens Vej 35, 2500 Valby, datatilsynet.dk.
        </p>
      </Section>

      <Section n="9" title="Cookies">
        <p>
          På websitet bruger vi nødvendige cookies til blandt andet at holde dig
          logget ind. De bruges ikke til reklamesporing på tværs af tjenester.
        </p>
        <p>
          Vi kan føre aggregeret driftsstatistik, der ikke bruges til at følge
          dig på tværs af andre apps eller websites.
        </p>
      </Section>

      <Section n="10" title="Sikkerhed">
        <p>
          Adgangskoder gemmes som sikre hashes og ikke i læsbar form. Trafik til
          og fra platformen beskyttes med kryptering under transport, og adgang
          til persondata begrænses til personer og systemer, der har et relevant
          behov.
        </p>
        <p>
          Ved et brud på persondatasikkerheden følger vi de gældende regler om
          vurdering og eventuel underretning af tilsynsmyndighed og berørte
          personer.
        </p>
      </Section>
    </LegalPage>
  );
}
