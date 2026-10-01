import localized from './localized-phrases.json' with {type:'json'};
import english from './phrases.json' with {type:'json'};
import translations from './translations.json' with {type:'json'};
const byDanish=new Map(Object.values(translations).map(entry=>[entry.da,entry]));
// Server actions also return messages with names and counts already inserted.
// Only recognise registered, complete templates; leave arbitrary text alone.
const templates=Object.entries(localized).filter(([key])=>/\{\w+\}/.test(key)).sort(([a],[b])=>b.replace(/\{\w+\}/g,'').length-a.replace(/\{\w+\}/g,'').length).map(([key,entry])=>{
 const names=[...key.matchAll(/\{(\w+)\}/g)].map(match=>match[1]);
 const parts=key.split(/\{\w+\}/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 return {entry,names,pattern:new RegExp('^'+parts.join('([\\s\\S]+?)')+'$')};
});
export function translatePhrase(value,locale='da',params={}) {
 if(typeof value!=='string')return value;
 const base=locale==='en-US'?'en':locale;
 let entry=localized[value]??byDanish.get(value);
 if(!entry&&locale!=='da')for(const template of templates){const match=template.pattern.exec(value);if(match){entry=template.entry;params={...Object.fromEntries(template.names.map((name,index)=>[name,match[index+1]])),...params};break;}}
 const translated=locale==='da'?entry?.da??value:entry?.[locale]??entry?.[base]??english[value]??value;
 return translated.replace(/\{(\w+)\}/g,(match,key)=>params[key]===undefined?match:String(params[key]));
}
