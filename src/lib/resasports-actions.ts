'use server';
import {requireCustomClub} from './club-management-actions';
import {fetchResasports,type ResaSnapshot} from './resasports';
export async function previewResasports(_prev:unknown,form:FormData):Promise<{snapshot?:ResaSnapshot;error?:string}>{
 try{
  const {club}=await requireCustomClub('import');
  if(form.get('venueTime')!=='on'&&!(club.timeZone==='Europe/Copenhagen'&&form.get('danishTime')==='on'))throw Error('Confirm that Resasports uses your venue time zone.');
  const snapshot=await fetchResasports({username:String(form.get('username')??''),password:String(form.get('password')??''),applicationId:String(form.get('applicationId')??''),actorId:String(form.get('actorId')??''),token:String(form.get('token')??''),sandbox:form.get('environment')==='sandbox'},String(form.get('from')??''),String(form.get('to')??''),fetch,club.timeZone);
  return{snapshot};
 }catch(e){return{error:e instanceof Error?e.message:'Data kunne ikke hentes.'};}
}
