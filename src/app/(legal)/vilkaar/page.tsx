import { Fill, LegalPage, Section } from "../LegalPage";

export const metadata = { title: "Handelsbetingelser — Tennis Makker" };

export default function VilkaarPage() {
  return (
    <LegalPage title="Handelsbetingelser" updated="29. august 2026">
      <Section n="1" title="Hvem du handler med">
        <p>
          Tennis Makker drives af <Fill>virksomhedsnavn</Fill>, CVR{" "}
          <Fill>CVR-nummer</Fill>, <Fill>adresse</Fill>. Du kan kontakte os på{" "}
          <Fill>e-mail</Fill>.
        </p>
        <p>
          Tennis Makker er en formidlingsplatform. Når du booker en bane, indgår
          du aftalen om selve banetiden med klubben. Når du booker en trænertime,
          indgår du aftalen med træneren. Vi formidler kontakten og håndterer
          betalingen, men leverer ikke selve ydelsen.
        </p>
      </Section>

      <Section n="2" title="Oprettelse af profil">
        <p>
          Du skal være fyldt 18 år for at oprette en profil og booke. Er du under
          18, skal en forælder eller værge oprette bookingen.
        </p>
        <p>
          Oplysningerne på din profil skal være korrekte. Du er ansvarlig for at
          holde din adgangskode fortrolig.
        </p>
      </Section>

      <Section n="3" title="Booking og betaling">
        <p>
          Når du vælger et tidspunkt, reserveres det i 10 minutter, mens du
          betaler. Betaler du ikke inden for de 10 minutter, frigives tiden igen.
        </p>
        <p>
          Aftalen er bindende, når betalingen er gennemført, og du har modtaget
          en bekræftelse på e-mail. Prisen fremgår altid, før du betaler, og er
          inklusive moms.
        </p>
        <p>
          Vi modtager betaling med <Fill>betalingsmetoder</Fill>. Beløbet
          trækkes ved bekræftelsen.
        </p>
      </Section>

      <Section n="4" title="Aflysning og refundering">
        <p>
          Du kan aflyse din booking via din profil. Aflyser du <strong>senest 24
          timer</strong> før spilletidspunktet, refunderes hele beløbet.
          Aflyser du senere, refunderes beløbet ikke.
        </p>
        <p>
          Refunderede beløb føres tilbage til det betalingsmiddel, du brugte.
          Der går typisk 5-10 hverdage, før beløbet står på din konto.
        </p>
        <p>
          Aflyser klubben eller træneren en booking, får du altid hele beløbet
          retur, uanset hvornår aflysningen sker.
        </p>
      </Section>

      <Section n="5" title="Fortrydelsesret">
        <p>
          Bookinger af banetid og trænertimer er tjenester, der leveres på et
          bestemt tidspunkt. Efter forbrugeraftalelovens § 18, stk. 2, nr. 12
          gælder den almindelige 14 dages fortrydelsesret derfor ikke for denne
          type booking.
        </p>
        <p>
          Vores aflysningsvilkår i punkt 4 gælder i stedet og stiller dig i
          praksis bedre end en fortrydelsesret ville i mange tilfælde.
        </p>
      </Section>

      <Section n="6" title="Aflysning på grund af vejr eller baneforhold">
        <p>
          Klubben afgør, om banerne er spilbare. Aflyser klubben på grund af
          vejr, baneforhold eller andre forhold hos klubben, refunderes hele
          beløbet.
        </p>
        <p>
          Møder du ikke op, eller vælger du selv ikke at spille på grund af
          vejret uden at klubben har aflyst, refunderes beløbet ikke.
        </p>
      </Section>

      <Section n="7" title="Adgang til klubbens faciliteter">
        <p>
          Din booking giver adgang til den bookede bane i det bookede tidsrum.
          Klubbens ordensregler gælder, mens du er på anlægget.
        </p>
        <p>
          Klubben oplyser, hvordan du får adgang til anlægget. Er du i tvivl,
          skal du kontakte klubben før spilletidspunktet.
        </p>
      </Section>

      <Section n="8" title="Makker-funktionen">
        <p>
          Slår du til på et opslag, udveksles jeres kontaktoplysninger, så I selv
          kan aftale nærmere. Tennis Makker er ikke part i den aftale og har
          ikke kontrolleret de oplysninger, brugere angiver om sig selv.
        </p>
        <p>
          Du spiller på eget ansvar. Vi anbefaler, at I mødes på et offentligt
          tilgængeligt anlæg.
        </p>
      </Section>

      <Section n="9" title="Ansvar">
        <p>
          Tennis Makker er ansvarlig efter dansk rets almindelige regler. Vi er
          ikke ansvarlige for skader, der opstår under spillet, for klubbens
          eller trænerens ydelse, eller for aftaler brugere indgår indbyrdes via
          makker-funktionen.
        </p>
        <p>
          Vi tilstræber, at platformen er tilgængelig døgnet rundt, men kan ikke
          garantere det. Vi er ikke erstatningsansvarlige for tab som følge af
          nedetid.
        </p>
      </Section>

      <Section n="10" title="Klage">
        <p>
          Er du utilfreds, så kontakt os først på <Fill>e-mail</Fill>. Fører det
          ikke til en løsning, kan du klage til Nævnenes Hus, Toldboden 2, 8800
          Viborg, via <Fill>naevneneshus.dk</Fill>.
        </p>
        <p>
          Du kan også bruge EU-Kommissionens klageportal på{" "}
          <Fill>ec.europa.eu/odr</Fill>.
        </p>
      </Section>

      <Section n="11" title="Ændringer">
        <p>
          Vi kan ændre disse betingelser. Ændringer varsles på e-mail mindst 30
          dage før, de træder i kraft. For allerede gennemførte bookinger gælder
          de betingelser, der var gældende ved bookingen.
        </p>
      </Section>

      <Section n="12" title="Lovvalg og værneting">
        <p>
          Aftalen er underlagt dansk ret. Tvister afgøres ved de danske
          domstole.
        </p>
      </Section>
    </LegalPage>
  );
}
