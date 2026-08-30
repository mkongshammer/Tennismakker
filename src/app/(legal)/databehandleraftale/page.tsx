import { Fill, LegalPage, Section } from "../LegalPage";

export const metadata = { title: "Databehandleraftale — RacketBuddy" };

export default function DatabehandleraftalePage() {
  return (
    <LegalPage title="Databehandleraftale" updated="29. august 2026">
      <p className="text-net/70">
        Denne aftale indgås mellem klubben (<strong>den dataansvarlige</strong>)
        og <Fill>virksomhedsnavn</Fill>, CVR <Fill>CVR-nummer</Fill> (
        <strong>databehandleren</strong>), når klubben opretter sig på Tennis
        Makker. Den opfylder kravet i databeskyttelsesforordningens artikel 28,
        stk. 3.
      </p>

      <Section n="1" title="Baggrund og formål">
        <p>
          Klubben bruger RacketBuddy til at vise ledige banetider til spillere
          uden medlemskab og til at modtage betaling for dem. I den forbindelse
          behandler vi personoplysninger på klubbens vegne.
        </p>
        <p>
          Vi behandler kun oplysningerne efter dokumenteret instruks fra klubben.
          Denne aftale, sammen med den funktionalitet klubben selv vælger i
          administrationen, udgør instruksen.
        </p>
      </Section>

      <Section n="2" title="Hvad vi behandler">
        <p>
          <strong>Kategorier af registrerede:</strong> klubbens medlemmer,
          gæstespillere der booker baner, og klubbens administratorer.
        </p>
        <p>
          <strong>Kategorier af oplysninger:</strong> navn, e-mail,
          telefonnummer, spillerniveau, område, bookinger og betalingshistorik.
        </p>
        <p>
          <strong>Ingen særlige kategorier.</strong> Platformen er ikke indrettet
          til helbredsoplysninger eller andre følsomme oplysninger efter artikel
          9. Klubben må ikke lægge sådanne oplysninger ind i systemet, fx i
          fritekstfelter.
        </p>
        <p>
          Har klubben medlemmer under 18 år, skal klubben sikre det fornødne
          samtykke fra forældre eller værge, før oplysningerne behandles.
        </p>
      </Section>

      <Section n="3" title="Vores forpligtelser">
        <p>Vi forpligter os til at:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>behandle oplysningerne udelukkende efter klubbens instruks</li>
          <li>sikre, at alle med adgang er underlagt tavshedspligt</li>
          <li>træffe de sikkerhedsforanstaltninger, der følger af artikel 32</li>
          <li>bistå klubben med at besvare henvendelser fra registrerede</li>
          <li>bistå klubben med anmeldelse af sikkerhedsbrud og konsekvensanalyser</li>
          <li>stille de oplysninger til rådighed, klubben skal bruge for at dokumentere overholdelse</li>
        </ul>
      </Section>

      <Section n="4" title="Sikkerhedsforanstaltninger">
        <p>
          Al trafik krypteres. Adgangskoder gemmes med envejskryptering.
          Databasen er adgangsbegrænset, og adgang gives kun til de personer,
          der har brug for den. Klubbens administratorer kan kun se oplysninger
          om egne baner, bookinger og medlemmer.
        </p>
        <p>
          <Fill>Udfyld: hvor ofte tages backup, hvor længe gemmes den, og
          hvordan testes gendannelse</Fill>.
        </p>
      </Section>

      <Section n="5" title="Underdatabehandlere">
        <p>
          Klubben giver generel godkendelse til, at vi bruger
          underdatabehandlere. Vi bruger i dag:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <Fill>hostingudbyder</Fill> — drift af server og database,{" "}
            <Fill>land</Fill>
          </li>
          <li>
            <Fill>betalingsudbyder</Fill> — betalingsformidling,{" "}
            <Fill>land</Fill>
          </li>
          <li>
            <Fill>e-mailudbyder</Fill> — udsendelse af kvitteringer og beskeder,{" "}
            <Fill>land</Fill>
          </li>
        </ul>
        <p>
          Vi varsler klubben mindst 30 dage før, vi tilføjer eller skifter
          underdatabehandler. Klubben kan gøre indsigelse. Fastholder vi
          ændringen, kan klubben opsige aftalen uden varsel.
        </p>
        <p>
          Vi pålægger alle underdatabehandlere de samme forpligtelser, som
          følger af denne aftale, og hæfter for deres behandling.
        </p>
      </Section>

      <Section n="6" title="Overførsel til tredjelande">
        <p>
          <Fill>Udfyld: om oplysninger overføres uden for EU/EØS, til hvilket
          land, og på hvilket overførselsgrundlag — typisk EU-Kommissionens
          standardkontraktbestemmelser. Overføres intet, skrives det her</Fill>.
        </p>
      </Section>

      <Section n="7" title="Brud på persondatasikkerheden">
        <p>
          Opdager vi et brud, underretter vi klubben uden unødig forsinkelse og
          senest 24 timer efter, vi er blevet opmærksomme på det.
        </p>
        <p>
          Underretningen beskriver, hvad der er sket, hvilke oplysninger og
          hvor mange personer der er berørt, de sandsynlige konsekvenser og hvad
          vi gør for at begrænse skaden. Det er klubben, der anmelder til
          Datatilsynet.
        </p>
      </Section>

      <Section n="8" title="Revision og dokumentation">
        <p>
          Klubben kan én gang årligt bede om dokumentation for, at vi overholder
          aftalen. Vi svarer inden for 30 dage.
        </p>
        <p>
          Ønsker klubben en fysisk revision, aftales tidspunkt og omfang på
          forhånd, og klubben afholder omkostningerne, medmindre revisionen
          afdækker væsentlig misligholdelse fra vores side.
        </p>
      </Section>

      <Section n="9" title="Ved aftalens ophør">
        <p>
          Når aftalen ophører, kan klubben inden for 30 dage bede om at få
          udleveret oplysningerne i et maskinlæsbart format.
        </p>
        <p>
          Derefter sletter vi oplysningerne. Undtaget er materiale, vi er
          forpligtet til at gemme efter bogføringsloven, som slettes, når
          opbevaringspligten udløber.
        </p>
      </Section>

      <Section n="10" title="Ansvar og ikrafttræden">
        <p>
          Parterne hæfter efter databeskyttelsesforordningens artikel 82 og
          dansk rets almindelige regler.
        </p>
        <p>
          Aftalen træder i kraft, når klubben oprettes på platformen, og løber,
          så længe vi behandler oplysninger på klubbens vegne. Ved uoverensstemmelse
          mellem denne aftale og øvrige aftaler mellem parterne går denne aftale
          forud for så vidt angår behandling af personoplysninger.
        </p>
      </Section>
    </LegalPage>
  );
}
