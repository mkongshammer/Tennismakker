/** Read-only legacy Nubapp API. Contract: https://sport.nubapp.com/api/v4/docs.json */
export type ResaSnapshot = {
 applicationId:string;
 members:{id:string;email:string;name:string;phone:string}[];
 facilities:{id:string;name:string}[];
 bookings:{id:string;userId:string;facilityId:string;start:string;end:string}[];
};
export type ResaCredentials = {username:string;password:string;applicationId:string;actorId:string;token?:string;sandbox:boolean};
const fail = () => new Error('Resasports returnerede uventede eller ufuldstændige data. Intet er importeret.');
function object(value:unknown):Record<string,unknown> {if(!value||typeof value!=='object'||Array.isArray(value))throw fail();return value as Record<string,unknown>;}
function id(value:unknown):string {const s=String(value??'');if(!/^[1-9]\d{0,14}$/.test(s))throw fail();return s;}
function text(value:unknown,max:number):string {if(typeof value!=='string'||value.length>max)throw fail();return value.trim();}

// Reject nonexistent AND ambiguous Danish wall-clock times rather than moving a booking.
export function resaDate(value:unknown):string {
 const s=text(value,19);if(!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(s))throw fail();
 const wall=Date.parse(s.replace(' ','T')+'Z');if(!Number.isFinite(wall))throw fail();
 const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Copenhagen',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const candidates=[1,2].map(offset=>new Date(wall-offset*3600000)).filter(d=>formatter.format(d)===s);
 if(candidates.length!==1)throw Error('Et bookingtidspunkt er ugyldigt eller tvetydigt ved sommertidsskift. Brug CSV med eksplicit tidszone for denne booking.');
 return candidates[0].toISOString().replace('.000Z','Z');
}
export async function fetchResasports(c:ResaCredentials, from:string, to:string, fetcher:typeof fetch=fetch):Promise<ResaSnapshot>{
 id(c.applicationId);id(c.actorId);
 if(!c.username||!c.password||c.username.length>200||c.password.length>1000||(c.token?.length??0)>4000)throw Error('Udfyld API-bruger, API-adgangskode, klub-ID og administrator-ID fra Nubapp.');
 for(const d of [from,to])if(!/^\d{4}-\d\d-\d\d$/.test(d)||new Date(d).toISOString().slice(0,10)!==d)throw Error('Vælg gyldige datoer.');
 if(to<from||Date.parse(to)-Date.parse(from)>366*86400000)throw Error('Vælg højst ét år.');
 const host=c.sandbox?'https://sport-sandbox.nubapp.com':'https://sport.nubapp.com';
 async function read(path:string,params:Record<string,string>,key:string):Promise<unknown[]> {
  const body=new URLSearchParams({u:c.username,p:c.password,id_application:c.applicationId,action_by:c.actorId,...params});if(c.token)body.set('token',c.token);
  let res:Response;
  try{res=await fetcher(`${host}/api/v4/${path}`,{method:'POST',body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw Error('Forbindelsen til Resasports kunne ikke gennemføres. Prøv igen.');}
  if(!res.ok)throw Error(`Resasports afviste opslaget (HTTP ${res.status}). Kontrollér API-adgang og rettigheder hos Nubapp.`);
  if(!res.body)throw fail();
  const reader=res.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>5_000_000){await reader.cancel();throw Error('For mange data. Vælg en kortere periode.');}chunks.push(value);}}finally{reader.releaseLock();}
  let result:Record<string,unknown>;try{result=object(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{throw fail();}
  if(result.success!==true)throw Error('Resasports gav ikke adgang til data. Kontrollér de godkendte API-rettigheder hos Nubapp.');
  const rows=object(result.data)[key];if(!Array.isArray(rows))throw fail();return rows;
 }
 const members:ResaSnapshot['members']=[];const seen=new Set<string>();const emails=new Set<string>();
 for(let page=1;page<=6;page++){
  const rows=await read('users/getUsers.php',{n_users:'100',page:String(page),credit:'0',tags:'0','id_type_of_user[]':'5','fields[]':'telephone'},'users');
  for(const raw of rows){const r=object(raw);const userId=id(r.id_user),email=text(r.email,254).toLowerCase(),name=[text(r.first_name,150),text(r.last_name,150)].filter(Boolean).join(' ');
   if(seen.has(userId)||emails.has(email)||!/^\S+@\S+\.\S+$/.test(email)||!name||name.length>150)throw Error('Medlemslisten indeholder gentagne ID’er, delte/manglende e-mails eller ugyldige navne. Ret data hos Resasports eller brug CSV-import.');
   seen.add(userId);emails.add(email);members.push({id:userId,email,name,phone:text(r.mobile||r.telephone||'',40)});
  }
  if(members.length>500)throw Error('Direkte import understøtter højst 500 rækker. Brug opdelt CSV-import til større klubber.');
  if(rows.length<100)break;
  if(page===6)throw fail();
 }
 const facilities=(await read('facilities/getFacilities.php',{},'facilities')).map(raw=>{const r=object(raw);return{id:id(r.id_facility),name:text(r.name_facility,150)};});
 if(new Set(facilities.map(f=>f.id)).size!==facilities.length)throw fail();
 const bookings=(await read('bookings/getBookings.php',{start_timestamp:from+' 00:00:00',end_timestamp:to+' 23:59:59'},'bookings')).map(raw=>{
  const r=object(raw);
  if(r.dead_timestamp!==null&&r.dead_timestamp!==undefined&&r.dead_timestamp!=='')throw Error('En booking har en udløbstid i Resasports. Afklar dens status før import eller brug CSV.');
  const b={id:id(r.id_booking),userId:id(r.id_user),facilityId:id(r.id_facility),start:resaDate(r.start_timestamp),end:resaDate(r.end_timestamp)};
  if(!seen.has(b.userId)||!facilities.some(f=>f.id===b.facilityId)||b.end<=b.start||Date.parse(b.end)-Date.parse(b.start)>86400000)throw fail();return b;
 });
 if(new Set(bookings.map(b=>b.id)).size!==bookings.length)throw fail();
 if(members.length+bookings.length>500)throw Error('Der er over 500 medlems- og bookingrækker. Vælg færre bookingdage eller brug opdelt CSV-import.');
 return {applicationId:c.applicationId,members,facilities,bookings};
}
export function resaCsv(snapshot:ResaSnapshot,mapping:Record<string,string>):string {
 const rows:string[][]=[['type','email','name','phone','court','start','end','external_id']];
 for(const m of snapshot.members)rows.push(['member',m.email,m.name,m.phone,'','','','']);
 for(const b of snapshot.bookings){const court=mapping[b.facilityId],member=snapshot.members.find(m=>m.id===b.userId);if(!court||!member)throw Error('Vælg en RacketBuddy-bane for alle baner med bookinger.');rows.push(['booking',member.email,'','',court,b.start,b.end,b.id]);}
 return rows.map(row=>row.map(cell=>'"'+cell.replaceAll('"','""')+'"').join(';')).join('\n');
}
