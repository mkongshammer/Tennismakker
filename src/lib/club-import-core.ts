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
 const headers=rows.shift()?.map(h=>h.trim().replace(/^\uFEFF/,'').toLowerCase())??[];
 if(!headers.includes('type')||!headers.includes('email')||new Set(headers).size!==headers.length)throw Error('Kolonnerne type og email er påkrævet. Brug skabelonen.');
 if(rows.length>500||!rows.length)throw Error('Importér mellem 1 og 500 rækker.');
 return rows.map((cells,index)=>{if(cells.length!==headers.length)throw Error(`Række ${index+2}: forkert antal kolonner.`);return Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));});
}
export function importDate(value:string) {
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z|[+-]\d\d:\d\d)$/.test(value))throw Error('Bookingtid skal indeholde tidszone, fx 2027-01-10T18:00:00+01:00.');
 const d=new Date(value);if(!Number.isFinite(+d))throw Error('Ugyldig dato.');return d;
}
