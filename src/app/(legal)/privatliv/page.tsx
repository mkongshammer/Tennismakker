import {getPreferences} from '../../../lib/preferences';
import {phrase} from '../../../lib/phrases';
import { LegalPage, Section } from "../LegalPage";
import { COMPANY, EU_REPRESENTATIVE } from "../company";

export const metadata = { title: "Privatlivspolitik — RacketBuddy" };

export default async function PrivatlivPage() {
 const {locale}=await getPreferences(); const tr=(s:string)=>` ${phrase(s,locale)} `;
  return (
    <LegalPage draft={false} title={tr("Privatlivspolitik")} updated={tr("22. september 2026")}>
      <Section n="1" title={tr("Dataansvarlig")}>
        <p>
          {COMPANY.name}, {tr(COMPANY.registration)}{tr(", med adresse")}{" "}
          {COMPANY.address}{tr(", er dataansvarlig for de oplysninger, du giver os, når du opretter en profil og bruger platformen.")}</p>
        <p>{tr("Har du spørgsmål til behandlingen af dine oplysninger, kan du skrive til")}{COMPANY.email}.
        </p>
        <p>{tr("Fordi selskabet er registreret uden for EU, har vi udpeget en repræsentant i EU efter databeskyttelsesforordningens artikel 27. Bor du i EU, kan du henvende dig direkte til")}{" "}
          {EU_REPRESENTATIVE.name}, {tr(EU_REPRESENTATIVE.country)}{tr(", på")}{" "}
          {EU_REPRESENTATIVE.email}{tr(". Du kan bruge den kontakt til alt, der handler om dine oplysninger — du behøver ikke skrive til USA.")}</p>
        <p>{tr("Bruger du platformen som medlem af en klub, er klubben selvstændigt dataansvarlig for de oplysninger, klubben selv behandler om dig. Vi er i den sammenhæng databehandler for klubben.")}</p>
      </Section>

      <Section n="2" title={tr("Hvilke oplysninger vi behandler")}>
        <p>{tr("Vi behandler følgende om dig:")}</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>{tr("Navn, e-mail og eventuelt telefonnummer")}</li>
          <li>{tr("Dit spillerniveau og område")}</li>
          <li>{tr("Dine bookinger og betalingshistorik")}</li>
          <li>{tr("Indholdet af de opslag, du selv opretter")}</li>
          <li>{tr("Tekniske oplysninger som IP-adresse og tidspunkter for login")}</li>
        </ul>
        <p>{tr("Vi opbevarer ikke dine kortoplysninger. Betalinger håndteres af")}{" "}{tr("Stripe, Inc., som er selvstændigt dataansvarlig for betalingsdata.")}</p>
      </Section>

      <Section n="3" title={tr("Hvad vi bruger oplysningerne til")}>
        <p>
          <strong>{tr("For at opfylde aftalen med dig")}</strong>{tr("(databeskyttelsesforordningens artikel 6, stk. 1, litra b): at oprette din profil, gennemføre bookinger, sende kvitteringer og formidle kontakt mellem spillere.")}</p>
        <p>
          <strong>{tr("For at overholde loven")}</strong>{tr("(artikel 6, stk. 1, litra c): bogføringsloven kræver, at vi gemmer regnskabsmateriale i 5 år.")}</p>
        <p>
          <strong>{tr("Efter en interesseafvejning")}</strong>{tr("(artikel 6, stk. 1, litra f): at drive og sikre platformen, forhindre misbrug og forbedre tjenesten. Vi har vurderet, at det ikke går forud for dine rettigheder.")}</p>
      </Section>

      <Section n="4" title={tr("Hvem oplysningerne deles med")}>
        <p>{tr("Booker du en bane, deler vi dit navn, din e-mail og bookingens tidspunkt med klubben, så de kan give dig adgang. Booker du en trænertime, deles de samme oplysninger med træneren.")}</p>
        <p>{tr("Slår du til på et makker-opslag, får opslagets ejer din e-mail og dit telefonnummer, hvis du har angivet det. Det sker kun, når du selv aktivt vælger at slå til.")}</p>
        <p>{tr("Vi bruger følgende databehandlere: Render Services, Inc. (drift, servere i Frankfurt), Stripe, Inc. (betaling) og Resend, Inc. (udsendelse af kvitteringer). Der er indgået databehandleraftaler med dem alle.")}</p>
        <p>{tr("Vi sælger ikke dine oplysninger og bruger dem ikke til reklamer fra tredjeparter.")}</p>
      </Section>

      <Section n="5" title={tr("Overførsel til lande uden for EU/EØS")}>
        <p>{tr("Ja. Vores servere og database ligger i Frankfurt, altså inden for EU. Men selskabet bag RacketBuddy er amerikansk, og både betalingsformidling (Stripe) og udsendelse af e-mail (Resend) sker fra USA. Overførslerne hviler på EU-Kommissionens standardkontraktbestemmelser og de respektive udbyderes egne overførselsordninger..")}</p>
      </Section>

      <Section n="6" title={tr("Hvor længe vi gemmer oplysningerne")}>
        <p>{tr("Din profil gemmes, så længe du har en konto. Sletter du din konto, slettes profiloplysningerne inden for 30 dage.")}</p>
        <p>{tr("Bookinger og betalinger gemmes i 5 år efter udgangen af det regnskabsår, de vedrører, fordi bogføringsloven kræver det.")}</p>
        <p>{tr("Makker-opslag slettes 12 måneder efter, de er lukket.")}</p>
      </Section>

      <Section n="7" title={tr("Børn og unge")}>
        <p>{tr("Platformen er beregnet til personer på 18 år og derover. Er du under 18, skal en forælder eller værge oprette profilen og stå for bookingen.")}</p>
        <p>{tr("Bliver vi opmærksomme på, at vi har oplysninger om et barn under 18 uden samtykke fra en forælder, sletter vi dem hurtigst muligt. Kontakt os på")}{" "}
          {COMPANY.email}{tr(", hvis du mener, det er tilfældet.")}</p>
      </Section>

      <Section n="8" title={tr("Dine rettigheder")}>
        <p>{tr("Du har ret til at:")}</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>{tr("få indsigt i, hvilke oplysninger vi har om dig")}</li>
          <li>{tr("få rettet forkerte oplysninger")}</li>
          <li>{tr("få slettet oplysninger, når vi ikke længere har grund til at gemme dem")}</li>
          <li>{tr("få begrænset behandlingen")}</li>
          <li>{tr("få dine oplysninger udleveret i et maskinlæsbart format")}</li>
          <li>{tr("gøre indsigelse mod behandling, der sker efter en interesseafvejning")}</li>
        </ul>
        <p>{tr("Skriv til")}{COMPANY.email}{tr(", så svarer vi inden for en måned. Du kan også slette din konto selv under Min profil.")}</p>
        <p>{tr("Er du utilfreds med vores behandling, kan du klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby, datatilsynet.dk.")}</p>
      </Section>

      <Section n="9" title={tr("Cookies")}>
        <p>{tr("Vi bruger en enkelt nødvendig cookie til at holde dig logget ind. Den kræver ikke samtykke, fordi tjenesten ikke kan fungere uden.")}</p>
        <p>{tr("Vi bruger ikke cookies til statistik, markedsføring eller sporing på tværs af hjemmesider.")}{" "}{tr("Vi tæller sidevisninger i et samlet tal pr. dag. Vi gemmer hverken cookie, IP-adresse eller hvilke sider der blev set, så tallet kan ikke føres tilbage til dig. Derfor er der ingen samtykke at bede om..")}</p>
      </Section>

      <Section n="10" title={tr("Sikkerhed")}>
        <p>{tr("Adgangskoder gemmes krypteret og kan ikke læses af os. Al trafik til og fra platformen er krypteret. Adgang til persondata er begrænset til de personer, der har brug for den.")}</p>
        <p>{tr("Sker der et brud på persondatasikkerheden, der indebærer en risiko for dig, underretter vi Datatilsynet inden for 72 timer og dig direkte, hvis risikoen er høj.")}</p>
      </Section>
      <Section n="11" title={tr("Pushnotifikationer i mobilappen")}>
        <p>{tr("Hvis du aktiverer push, gemmer vi telefonens push-token og dine valg af notifikationer. Vi bruger Expo samt Apples eller Googles pushtjeneste til at sende beskeder om bookinger, påmindelser, trænerforespørgsler og ulæste beskeder. Pushbeskeder indeholder ikke indholdet af din chat, betalingsoplysninger eller adgangskoder til klubben.")}</p>
        <p>{tr("Du kan ændre dine valg eller deaktivere push under Min profil. Enhedens tilmelding fjernes ved logout og kontosletning og udløber senest med din login-session. Tekniske afsendelsesoplysninger ryddes efter 30 dage. Telefonens egne indstillinger styrer også, om notifikationer vises.")}</p>
      </Section>
    </LegalPage>
  );
}
