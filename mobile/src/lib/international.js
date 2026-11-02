import {setDateLocale} from './dates.js';
import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {translatePhrase} from '../../../shared/phrase-translation.mjs';
import {MARKETS,CURRENCIES,TIME_ZONES,LANGUAGES,LANGUAGE_NAMES,marketFor,countryLabel,validLocale,formatMoney,formatDate} from '../../../shared/international.mjs';
export {MARKETS,CURRENCIES,TIME_ZONES,LANGUAGES,LANGUAGE_NAMES,marketFor,countryLabel};
const KEY='rb_international_v1';
const language=Intl.DateTimeFormat().resolvedOptions().locale;
// The app is for the US market: American English, or Spanish when the phone is set to Spanish.
export const APP_LANGUAGES=['en-US','es'];
export const APP_LANGUAGE_NAMES={'en-US':'English','es':'Español'};
export const appLocale=value=>String(value??'').toLowerCase().startsWith('es')?'es':'en-US';
const initialLocale=appLocale(language);
let preferences={country:'US',locale:initialLocale,countryChosen:true,languageChosen:false};
setDateLocale(initialLocale);
const listeners=new Set();
export function getInternational(){return preferences;}
export function tr(text,params){return translatePhrase(text,preferences.locale,params);}
export function money(amount,currency='DKK'){return formatMoney(amount,currency,preferences.locale);}
export function date(instant,timeZone='Europe/Copenhagen',options){return formatDate(instant,preferences.locale,timeZone,options);}
function apply(value){
  const chosen=value.languageChosen??preferences.languageChosen;
  const next={country:'US',locale:value.locale&&(chosen||appLocale(value.locale)==='es')?appLocale(value.locale):preferences.locale,countryChosen:true,languageChosen:value.languageChosen??(value.id&&value.countryChosen?true:preferences.languageChosen)};
  if(Object.keys(next).some(key=>next[key]!==preferences[key])){preferences=next;setDateLocale(next.locale);listeners.forEach(listener=>listener());}
}
export async function restoreInternational(){try{const stored=await AsyncStorage.getItem(KEY);if(stored){const value=JSON.parse(stored);apply({...value,countryChosen:value.countryChosen??!!marketFor(value.country),languageChosen:value.languageChosen??!!value.locale});}}catch{}}
export async function setInternational(value){apply(value);try{await AsyncStorage.setItem(KEY,JSON.stringify(preferences));}catch{}}
export function useInternational(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getInternational,getInternational);return {...current,t:tr,money,date,setInternational};}
