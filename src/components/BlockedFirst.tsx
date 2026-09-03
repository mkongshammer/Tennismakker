// Fluebenet, der gør dobbeltbooking umulig.
//
// Klubber med eget bookingsystem skal spærre tiden dér, før den frigives
// hos os. Det er ikke en formalitet: Halbooking har ingen grænseflade, vi
// kan skrive til, så den her rækkefølge er hele beskyttelsen. Serveren
// afviser uden fluebenet — komponenten her er kun det synlige spørgsmål.
export function BlockedFirst({ system }: { system: string | null }) {
  if (!system) return null;

  return (
    <label className="flex cursor-pointer gap-3 rounded-xl border-2 border-court/30 bg-court/5 p-3">
      <input type="checkbox" name="blockedFirst" required className="mt-1" />
      <span className="text-sm">
        <span className="font-bold">Jeg har spærret disse tider i {system} først.</span>
        <span className="mt-1 block text-slate">
          Så kan et medlem ikke nå at booke samme time dér. Bagefter findes
          tiden kun hos os — og når en gæst booker, skriver I bare navnet på.
        </span>
      </span>
    </label>
  );
}
