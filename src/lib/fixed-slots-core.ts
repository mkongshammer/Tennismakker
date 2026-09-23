// Fast bane — datoregningen.
//
// Uden importer, så den kan afprøves. Det er den del, der kan gå galt uden
// at nogen ser det: en sæson der mangler den sidste uge, eller får en for
// meget.
//
// Samme bane, samme ugedag, samme klokkeslæt, hele sæsonen. Reglen står i
// FixedSlot; de enkelte timer oprettes som almindelige Booking-rækker.
//
// Hvorfor rigtige rækker frem for at regne dem ud, hver gang nogen ser på
// kalenderen: så virker ledighed, aflysning, kvitteringer, dørkoder og
// klubbens overblik uændret. Der er én slags booking i resten af systemet,
// og det er den, alt andet allerede kan håndtere. En "virtuel" booking
// ville skulle indarbejdes i hvert eneste opslag — og glemmes i ét af dem.

export type FixedSlotInput = {
  courtId: string;
  userId: string;
  dayOfWeek: number;
  hour: number;
  fromDate: Date;
  toDate: Date;
  priceKr: number;
  note?: string | null;
};

/** Alle datoer i perioden, der falder på den ugedag. */
export function occurrences(from: Date, to: Date, dayOfWeek: number, hour: number, timeZone?:string): Date[] {
  if(timeZone)return zonedOccurrences(from,to,dayOfWeek,hour,timeZone);
  const out: Date[] = [];
  const cursor = new Date(from);
  cursor.setHours(hour, 0, 0, 0);

  // Frem til den første forekomst af ugedagen.
  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1);
  }

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}


/** Local wall-clock recurrence, preserving the chosen hour across daylight saving. */
export function zonedOccurrences(from:Date,to:Date,day:number,hour:number,timeZone:string):Date[] {
 if(!Number.isInteger(day)||day<0||day>6||!Number.isInteger(hour)||hour<0||hour>23||!Number.isFinite(+from)||!Number.isFinite(+to)||to<from||+to-+from>366*86400000)throw Error('Ugyldig gentagelse.');
 const out:Date[]=[];
 const formatter=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let d=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),from.getUTCDate()));+d<=+to;d.setUTCDate(d.getUTCDate()+1)){
  if(d.getUTCDay()!==day)continue;
  const wall=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),hour);let instant=wall;
  for(let i=0;i<3;i++){
   const p=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
   const actual=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);
   if(actual===wall)break;instant+=wall-actual;
  }
  const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
  if(+parts.hour!==hour)throw Error('Et tidspunkt findes ikke ved skift til sommertid. Vælg en anden time.');
  out.push(new Date(instant));
 }
 return out;
}
