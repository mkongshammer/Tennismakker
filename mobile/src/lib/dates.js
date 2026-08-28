// Dansk datoformatering uden ekstra afhængigheder.
const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const DAYS_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

export const time = (d) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export const dayShort = (d) => `${DAYS_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

export const dayLong = (d) => `${DAYS[d.getDay()]} d. ${d.getDate()}. ${MONTHS[d.getMonth()]}`;

export const dateTimeLong = (d) => `${dayLong(d)} kl. ${time(d)}`;

export const isoDay = (d) => d.toISOString().slice(0, 10);

/** Grupperer tider (ISO-strenge eller objekter med startsAt) pr. kalenderdag. */
export function groupByDay(items, getDate) {
  const map = new Map();
  for (const item of items) {
    const d = getDate(item);
    const key = isoDay(d);
    if (!map.has(key)) map.set(key, { date: d, items: [] });
    map.get(key).items.push(item);
  }
  return Array.from(map.values());
}
