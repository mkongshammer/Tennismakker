import { Fill, LegalPage, Section } from "../LegalPage";

export const metadata = { title: "Privatlivspolitik — RacketBuddy" };

export default function PrivatlivPage() {
  return (
    <LegalPage title="Privatlivspolitik" updated="29. august 2026">
      <Section n="1" title="Dataansvarlig">
        <p>
          <Fill>virksomhedsnavn</Fill>, CVR <Fill>CVR-nummer</Fill>,{" "}
          <Fill>adresse</Fill>, er dataansvarlig for de oplysninger, du giver os,
          når du opretter en profil og bruger platformen.
        </p>
        <p>
          Har du spørgsmål til behandlingen af dine oplysninger, kan du skrive
          til <Fill>e-mail</Fill>.
        </p>
        <p>
          Bruger du platformen som medlem af en klub, er klubben selvstændigt
          dataansvarlig for de oplysninger, klubben selv behandler om dig. Vi er
          i den sammenhæng databehandler for klubben.
        </p>
      </Section>

      <Section n="2" title="Hvilke oplysninger vi behandler">
        <p>Vi behandler følgende om dig:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Navn, e-mail og eventuelt telefonnummer</li>
          <li>Dit spillerniveau og område</li>
          <li>Dine bookinger og betalingshistorik</li>
          <li>Indholdet af de opslag, du selv opretter</li>
          <li>Tekniske oplysninger som IP-adresse og tidspunkter for login</li>
        </ul>
        <p>
          Vi opbevarer ikke dine kortoplysninger. Betalinger håndteres af{" "}
          <Fill>betalingsudbyder</Fill>, som er selvstændigt dataansvarlig for
          betalingsdata.
        </p>
      </Section>

      <Section n="3" title="Hvad vi bruger oplysningerne til">
        <p>
          <strong>For at opfylde aftalen med dig</strong> (databeskyttelsesforordningens
          artikel 6, stk. 1, litra b): at oprette din profil, gennemføre
          bookinger, sende kvitteringer og formidle kontakt mellem spillere.
        </p>
        <p>
          <strong>For at overholde loven</strong> (artikel 6, stk. 1, litra c):
          bogføringsloven kræver, at vi gemmer regnskabsmateriale i 5 år.
        </p>
        <p>
          <strong>Efter en interesseafvejning</strong> (artikel 6, stk. 1, litra f):
          at drive og sikre platformen, forhindre misbrug og forbedre tjenesten.
          Vi har vurderet, at det ikke går forud for dine rettigheder.
        </p>
      </Section>

      <Section n="4" title="Hvem oplysningerne deles med">
        <p>
          Booker du en bane, deler vi dit navn, din e-mail og bookingens
          tidspunkt med klubben, så de kan give dig adgang. Booker du en
          trænertime, deles de samme oplysninger med træneren.
        </p>
        <p>
          Slår du til på et makker-opslag, får opslagets ejer din e-mail og dit
          telefonnummer, hvis du har angivet det. Det sker kun, når du selv
          aktivt vælger at slå til.
        </p>
        <p>
          Vi bruger følgende databehandlere: <Fill>hostingudbyder</Fill>{" "}
          (drift), <Fill>betalingsudbyder</Fill> (betaling) og{" "}
          <Fill>e-mailudbyder</Fill> (udsendelse af kvitteringer). Der er indgået
          databehandleraftaler med dem alle.
        </p>
        <p>
          Vi sælger ikke dine oplysninger og bruger dem ikke til reklamer fra
          tredjeparter.
        </p>
      </Section>

      <Section n="5" title="Overførsel til lande uden for EU/EØS">
        <p>
          <Fill>Udfyld: om nogen af jeres databehandlere ligger uden for EU/EØS,
          og på hvilket grundlag overførslen sker — typisk EU-Kommissionens
          standardkontraktbestemmelser</Fill>.
        </p>
      </Section>

      <Section n="6" title="Hvor længe vi gemmer oplysningerne">
        <p>
          Din profil gemmes, så længe du har en konto. Sletter du din konto,
          slettes profiloplysningerne inden for 30 dage.
        </p>
        <p>
          Bookinger og betalinger gemmes i 5 år efter udgangen af det regnskabsår,
          de vedrører, fordi bogføringsloven kræver det.
        </p>
        <p>Makker-opslag slettes 12 måneder efter, de er lukket.</p>
      </Section>

      <Section n="7" title="Børn og unge">
        <p>
          Platformen er beregnet til personer på 18 år og derover. Er du under
          18, skal en forælder eller værge oprette profilen og stå for
          bookingen.
        </p>
        <p>
          Bliver vi opmærksomme på, at vi har oplysninger om et barn under 18 uden
          samtykke fra en forælder, sletter vi dem hurtigst muligt. Kontakt os på{" "}
          <Fill>e-mail</Fill>, hvis du mener, det er tilfældet.
        </p>
      </Section>

      <Section n="8" title="Dine rettigheder">
        <p>Du har ret til at:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>få indsigt i, hvilke oplysninger vi har om dig</li>
          <li>få rettet forkerte oplysninger</li>
          <li>få slettet oplysninger, når vi ikke længere har grund til at gemme dem</li>
          <li>få begrænset behandlingen</li>
          <li>få dine oplysninger udleveret i et maskinlæsbart format</li>
          <li>gøre indsigelse mod behandling, der sker efter en interesseafvejning</li>
        </ul>
        <p>
          Skriv til <Fill>e-mail</Fill>, så svarer vi inden for en måned.
        </p>
        <p>
          Er du utilfreds med vores behandling, kan du klage til Datatilsynet,
          Carl Jacobsens Vej 35, 2500 Valby, datatilsynet.dk.
        </p>
      </Section>

      <Section n="9" title="Cookies">
        <p>
          Vi bruger en enkelt nødvendig cookie til at holde dig logget ind. Den
          kræver ikke samtykke, fordi tjenesten ikke kan fungere uden.
        </p>
        <p>
          Vi bruger ikke cookies til statistik, markedsføring eller sporing på
          tværs af hjemmesider.{" "}
          <Fill>Tilføjer I analyseværktøjer senere, skal denne del opdateres, og
          der skal indhentes samtykke</Fill>.
        </p>
      </Section>

      <Section n="10" title="Sikkerhed">
        <p>
          Adgangskoder gemmes krypteret og kan ikke læses af os. Al trafik til og
          fra platformen er krypteret. Adgang til persondata er begrænset til de
          personer, der har brug for den.
        </p>
        <p>
          Sker der et brud på persondatasikkerheden, der indebærer en risiko for
          dig, underretter vi Datatilsynet inden for 72 timer og dig direkte,
          hvis risikoen er høj.
        </p>
      </Section>
    </LegalPage>
  );
}
