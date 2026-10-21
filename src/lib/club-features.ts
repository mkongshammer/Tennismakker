import type { AdminSection } from './admin-navigation';
export const CUSTOM_FEATURES = [
 {id:'medlemmer',label:'Medlemmer og kontingenter'},
 {id:'hold',label:'Hold og sæsontræning'},
 {id:'lys-adgang',label:'Lysstyring og digital døradgang'},
 {id:'priser',label:'Wallet, prisregler og klippekort'},
 {id:'hjemmeside',label:'Klubhjemmeside og kontaktpersoner'},
 {id:'nyheder',label:'Klubnyheder'},
 {id:'faste-bookinger',label:'Faste og gentagne banebookinger'},
 {id:'import',label:'Import og flytning fra andre systemer'},
 {id:'events',label:'Events, turneringer og rangliste'},
 {id:'kommunikation',label:'Mails og sms til medlemmer'},
 {id:'butik',label:'Butik og gavekort'},
 {id:'vagtplan',label:'Vagtplan'},
 {id:'rapporter',label:'Rapporter og regnskabseksport'},
] as const;
// Added after the one-plan launch: every full-system club has them, also
// clubs whose stored feature list predates them.
const ALWAYS_ON: readonly string[] = ['events','kommunikation','butik','vagtplan','rapporter'];
export type CustomFeature=typeof CUSTOM_FEATURES[number]['id'];
export const STANDARD_SECTIONS: AdminSection[] = ['oversigt','bookinger','tider','baner','betaling','integrationer','indstillinger'];
export function clubHasFeature(mode:string|undefined,features:string|null|undefined,feature:CustomFeature){
 if(mode!=='CUSTOM')return false;
 if(ALWAYS_ON.includes(feature))return true;
 if(features==null)return true; // Existing bespoke agreements keep their modules.
 try{const selected=JSON.parse(features);return Array.isArray(selected)&&selected.includes(feature);}catch{return false;}
}
export function clubHasSection(mode:string|undefined,section:AdminSection,features?:string|null){
 return STANDARD_SECTIONS.includes(section)||clubHasFeature(mode,features,section as CustomFeature);
}
export function normaliseFeatures(mode:string,input:string[]){
 if(!['STANDARD','CUSTOM'].includes(mode))throw Error('Vælg Standard eller Custom.');
 if(mode==='STANDARD')return [];
 const selected=[...new Set(input)];if(!selected.length||selected.some(x=>!CUSTOM_FEATURES.some(f=>f.id===x)))throw Error('Vælg mindst én gyldig custom-funktion.');return selected.sort();
}
