'use server';
import {requireCustomClub} from './club-management-actions';
import {fetchResasports,type ResaSnapshot} from './resasports';
export async function previewResasports(_prev:unknown,form:FormData):Promise<{snapshot?:ResaSnapshot;error?:string}>{
 try{
  await requireCustomClub();
  if(form.get('danishTime')!=='on')throw Error('Bekræft at klubbens Resasports-tider bruger dansk tidszone.');
  const snapshot=await fetchResasports({username:String(form.get('username')??''),password:String(form.get('password')??''),applicationId:String(form.get('applicationId')??''),actorId:String(form.get('actorId')??''),token:String(form.get('token')??''),sandbox:form.get('environment')==='sandbox'},String(form.get('from')??''),String(form.get('to')??''));
  return{snapshot};
 }catch(e){return{error:e instanceof Error?e.message:'Data kunne ikke hentes.'};}
}
