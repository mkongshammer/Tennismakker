import {setDateLocale} from './dates.js';
import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import phrases from '../../../shared/phrases.json';
import translations from '../../../shared/translations.json';
import {MARKETS,CURRENCIES,TIME_ZONES,LANGUAGES,LANGUAGE_NAMES,marketFor,countryLabel,validLocale,formatMoney,formatDate} from '../../../shared/international.mjs';
export {MARKETS,CURRENCIES,TIME_ZONES,LANGUAGES,LANGUAGE_NAMES,marketFor,countryLabel};
const KEY='rb_international_v1';
const language=Intl.DateTimeFormat().resolvedOptions().locale;
const initialLocale=validLocale(language)?language:validLocale(language.split('-')[0])?language.split('-')[0]:'en';
let preferences={country:'DK',locale:initialLocale};
setDateLocale(initialLocale);
const listeners=new Set();
const entries=new Map(Object.values(translations).map(value=>[value.da,value]));
export function getInternational(){return preferences;}
export function tr(text){
  if(typeof text!=='string'||preferences.locale==='da')return text;
  const entry=entries.get(text),locale=preferences.locale==='en-US'?'en':preferences.locale;
  return (preferences.locale==='en-US'?entry?.['en-US']:undefined)||entry?.[locale]||phrases[text]||text;
}
export function money(amount,currency='DKK'){return formatMoney(amount,currency,preferences.locale);}
export function date(instant,timeZone='Europe/Copenhagen',options){return formatDate(instant,preferences.locale,timeZone,options);}
function apply(value){
  const next={country:marketFor(value.country)?.code??preferences.country,locale:validLocale(value.locale)?value.locale:preferences.locale};
  if(next.country!==preferences.country||next.locale!==preferences.locale){preferences=next;setDateLocale(next.locale);listeners.forEach(listener=>listener());}
}
export async function restoreInternational(){try{const value=await AsyncStorage.getItem(KEY);if(value)apply(JSON.parse(value));}catch{}}
export async function setInternational(value){apply(value);try{await AsyncStorage.setItem(KEY,JSON.stringify(preferences));}catch{}}
export function useInternational(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getInternational,getInternational);return {...current,t:tr,money,date,setInternational};}
