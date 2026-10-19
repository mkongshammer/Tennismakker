// Project the full dictionaries down to English for the browser bundle.
// Run after editing shared/*.json: node scripts/sync-client-dictionary.mjs
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','shared');
const read=name=>JSON.parse(readFileSync(path.join(dir,name),'utf8'));
export function projectClientDictionary({localized,english,translations}){
 const pick=entry=>Object.fromEntries(Object.entries(entry).filter(([locale])=>locale==='en'||locale==='en-US'));
 return {
  english,
  localized:Object.fromEntries(Object.entries(localized).map(([key,entry])=>[key,pick(entry)])),
  translations:Object.fromEntries(Object.entries(translations).map(([key,entry])=>[key,{da:entry.da,...pick(entry)}])),
 };
}
export function clientDictionaryJson(){
 return JSON.stringify(projectClientDictionary({localized:read('localized-phrases.json'),english:read('phrases.json'),translations:read('translations.json')}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 writeFileSync(path.join(dir,'client-dictionary.json'),clientDictionaryJson()+'\n');
 console.log('shared/client-dictionary.json updated');
}
