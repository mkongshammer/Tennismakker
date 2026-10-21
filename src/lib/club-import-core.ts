export function parseClubCsv(text:string) {
 if(text.length>200000)throw Error('Filen er for stor. Importér højst 500 rækker ad gangen.');
 const separator=text.split(/\r?\n/)[0].includes(';')?';':',';
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===separator&&!quoted){row.push(cell);cell='';}
  else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('CSV-filen har et uafsluttet tekstfelt.');
 row.push(cell.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);
 // Member lists come straight out of spreadsheets and other systems, so the
 // usual header spellings are accepted, and a list without a type column is
 // read as members only.
 const ALIASES:Record<string,string>={'e-mail':'email','email address':'email','e-mail address':'email','mail':'email','full name':'name','member name':'name','navn':'name','first name':'first_name','firstname':'first_name','fornavn':'first_name','last name':'last_name','lastname':'last_name','surname':'last_name','efternavn':'last_name','phone number':'phone','mobile':'phone','mobile phone':'phone','cell':'phone','cell phone':'phone','telefon':'phone','mobil':'phone'};
 const headers=rows.shift()?.map(h=>{const k=h.trim().replace(/^\uFEFF/,'').toLowerCase();return ALIASES[k]??k;})??[];
 if(!headers.includes('email')||new Set(headers).size!==headers.length)throw Error('Kolonnen email er påkrævet. Brug skabelonen.');
 if(rows.length>500||!rows.length)throw Error('Importér mellem 1 og 500 rækker.');
 return rows.map((cells,index)=>{
  if(cells.length!==headers.length)throw Error(`Række ${index+2}: forkert antal kolonner.`);
  const r:Record<string,string>=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));
  if(!headers.includes('type'))r.type='member';
  if(!r.name&&(r.first_name||r.last_name))r.name=[r.first_name,r.last_name].filter(Boolean).join(' ');
  return r;
 });
}
export function importDate(value:string) {
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(value))throw Error('Bookingtid skal indeholde tidszone, fx 2027-01-10T18:00:00+01:00.');
 const d=new Date(value);if(!Number.isFinite(+d))throw Error('Ugyldig dato.');return d;
}
