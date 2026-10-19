import {formatDate,dayKey} from '../../../shared/international.mjs';
let locale='da';
export function setDateLocale(value){locale=value;}
// A booking's venue zone is explicit. The customer's device zone never changes a slot.
const stamp=(d,zone,options)=>formatDate(d,locale,zone??'America/New_York',options);
// Americans read "8:00 AM"; other locales keep the 24-hour clock.
const clock=()=>locale==='en-US'?{hour:'numeric',minute:'2-digit',hour12:true}:{hour:'2-digit',minute:'2-digit',hour12:false};
export const time=(d,zone)=>stamp(d,zone,clock());
export const dayShort=(d,zone)=>stamp(d,zone,{weekday:'short',day:'numeric',month:'numeric'});
export const dayLong=(d,zone)=>stamp(d,zone,{weekday:'long',day:'numeric',month:'long'});
export const dateTimeLong=(d,zone)=>stamp(d,zone,{weekday:'short',day:'numeric',month:'short',...clock()});
export const weekday=(d,zone)=>stamp(d,zone,{weekday:'long'});
export const isoDay=(d,zone)=>dayKey(d,zone??'America/New_York');
export function groupByDay(items,getDate,zone){const map=new Map();for(const item of items){const d=getDate(item),key=isoDay(d,zone);if(!map.has(key))map.set(key,{date:d,items:[]});map.get(key).items.push(item);}return Array.from(map.values());}
