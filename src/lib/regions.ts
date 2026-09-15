export const DK_REGIONS = [
  "Region Hovedstaden",
  "Region Sjælland",
  "Region Syddanmark",
  "Region Midtjylland",
  "Region Nordjylland",
] as const;

export type DanishRegion = (typeof DK_REGIONS)[number];

function normalise(value: string) {
  return value
    .toLocaleLowerCase("da")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ");
}

export function isDanishRegion(value: string | null | undefined): value is DanishRegion {
  return DK_REGIONS.includes((value ?? "") as DanishRegion);
}

/**
 * Nye profiler og opslag gemmer regionen direkte. De gamle data indeholder
 * byer/områder, så de mappes fortsat til en region, indtil de er redigeret.
 */
export function regionForArea(area: string | null | undefined): DanishRegion | null {
  if (!area) return null;
  if (isDanishRegion(area)) return area;

  const a = normalise(area);
  const match = (terms: string[]) => terms.some((term) => a.includes(normalise(term)));

  if (
    match([
      "københavn", "frederiksberg", "gentofte", "lyngby", "gladsaxe", "herlev", "ballerup",
      "rødovre", "hvidovre", "brøndby", "glostrup", "albertslund", "høje taastrup", "taastrup",
      "ishøj", "vallensbæk", "tårnby", "dragør", "rudersdal", "birkerød", "hørsholm", "allerød",
      "fredensborg", "helsingør", "hillerød", "frederikssund", "bornholm", "rønne",
    ])
  ) return "Region Hovedstaden";

  if (
    match([
      "roskilde", "køge", "greve", "solrød", "lejre", "ringsted", "sorø", "slagelse", "korsør",
      "kalundborg", "holbæk", "odsherred", "næstved", "vordingborg", "faxe", "stevns", "haslev",
      "nykøbing falster", "guldborgsund", "lolland", "nakskov", "maribo",
    ])
  ) return "Region Sjælland";

  if (
    match([
      "odense", "svendborg", "nyborg", "kerteminde", "middelfart", "assens", "faaborg", "fyn",
      "esbjerg", "varde", "vejen", "billund", "fredericia", "kolding", "vejle", "haderslev",
      "aabenraa", "sønderborg", "tønder", "ribe",
    ])
  ) return "Region Syddanmark";

  if (
    match([
      "aarhus", "århus", "skanderborg", "horsens", "silkeborg", "randers", "favrskov", "viborg",
      "herning", "holstebro", "ringkøbing", "skjern", "struer", "lemvig", "samsø", "grenaa",
      "djursland", "ebeltoft",
    ])
  ) return "Region Midtjylland";

  if (
    match([
      "aalborg", "ålborg", "hjørring", "frederikshavn", "skagen", "brønderslev", "jammerbugt",
      "thisted", "mors", "morsø", "vesthimmerland", "hadsund", "hobro", "mariager",
    ])
  ) return "Region Nordjylland";

  return null;
}
