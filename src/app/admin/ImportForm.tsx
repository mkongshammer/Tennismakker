'use client';
import {useFormState} from 'react-dom';
import {useState} from 'react';
import {useWebsiteInternational} from '../../components/InternationalProvider';
import {importClubData} from '../../lib/club-import-actions';
const EXAMPLE='type;email;name;phone;court;start;end;external_id\nmember;member@example.invalid;Example Name;12345678;;;;\nbooking;member@example.invalid;;;Court 1;2027-01-10T18:00:00+01:00;2027-01-10T19:00:00+01:00;booking-123';
export function ImportForm({initialCsv='',initialSource=''}:{initialCsv?:string;initialSource?:string}={}) {
 const {tr}=useWebsiteInternational(),[state,action]=useFormState(importClubData,null),[csv,setCsv]=useState(initialCsv),[fileError,setFileError]=useState('');
 return <section className="card space-y-4">
  <h2 className="display text-2xl">{tr('Flyt medlemmer og bookinger')}</h2>
  <p className="text-sm text-slate">{tr('Eksportér fra det gamle system og tilpas kolonnerne til skabelonen. Importér højst 500 rækker ad gangen. Banenavne skal matche jeres baner præcist. Dette er en engangsimport; kalenderfeed er til løbende synkronisering.')}</p>
  <pre className="overflow-x-auto rounded-xl bg-mist p-3 text-xs">{EXAMPLE}</pre>
  <form action={action} className="space-y-3">
   <label className="label">{tr('Kildesystem')}<input className="input" name="source" defaultValue={initialSource} placeholder="Resasports" required/></label>
   <label className="label block">{tr('Vælg CSV-fil')}<input type="file" accept=".csv,text/csv" className="input" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>200000){setFileError('Filen må højst være 200 KB.');return;}setFileError('');setCsv(await file.text());}}/></label>
   <label className="label">{tr('Eller indsæt CSV')}<textarea name="csv" className="input min-h-48" required value={csv} onChange={e=>setCsv(e.target.value)}/></label>
   {fileError&&<p role="alert">{tr(fileError)}</p>}
   <button name="intent" value="preview" className="btn-ghost">{tr('Vis forhåndsvisning')}</button>
   {state?.preview&&<div className="space-y-3"><p>{tr(state.preview)}</p><input type="hidden" name="digest" value={state.digest}/><label className="flex gap-2"><input name="confirmed" type="checkbox"/>{tr('Jeg har gennemgået data og har ret til at flytte dem.')}</label><button name="intent" value="import" className="btn-court">{tr('Bekræft import')}</button></div>}
  </form>
  {state?.error&&<p role="alert">{tr(state.error)}</p>}{state?.ok&&<p>{tr(state.ok)}</p>}
 </section>;
}
