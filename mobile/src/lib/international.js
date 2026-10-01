import {setDateLocale} from './dates.js';
import {useSyncExternalStore} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {translatePhrase} from '../../../shared/phrase-translation.mjs';
import {MARKETS,CURRENCIES,TIME_ZONES,LANGUAGES,LANGUAGE_NAMES,marketFor,countryLabel,validLocale,formatMoney,formatDate} from '../../../shared/international.mjs';
export {MARKETS,CURRENCIES,TIME_ZONES,LANGUAGES,LANGUAGE_NAMES,marketFor,countryLabel};
const KEY='rb_international_v1';
const language=Intl.DateTimeFormat().resolvedOptions().locale;
const initialLocale=validLocale(language)?language:validLocale(language.split('-')[0])?language.split('-')[0]:'en';
let preferences={country:'DK',locale:initialLocale,countryChosen:false,languageChosen:false};
setDateLocale(initialLocale);
const listeners=new Set();
export function getInternational(){return preferences;}
export function tr(text,params){return translatePhrase(text,preferences.locale,params);}
export function money(amount,currency='DKK'){return formatMoney(amount,currency,preferences.locale);}
export function date(instant,timeZone='Europe/Copenhagen',options){return formatDate(instant,preferences.locale,timeZone,options);}
function apply(value){
  const next={country:marketFor(value.country)?.code??preferences.country,locale:validLocale(value.locale)?value.locale:preferences.locale,countryChosen:value.countryChosen??preferences.countryChosen,languageChosen:value.languageChosen??(value.id&&value.countryChosen?true:preferences.languageChosen)};
  if(Object.keys(next).some(key=>next[key]!==preferences[key])){preferences=next;setDateLocale(next.locale);listeners.forEach(listener=>listener());}
}
export async function restoreInternational(){try{const stored=await AsyncStorage.getItem(KEY);if(stored){const value=JSON.parse(stored);apply({...value,countryChosen:value.countryChosen??!!marketFor(value.country),languageChosen:value.languageChosen??!!value.locale});}}catch{}}
export async function setInternational(value){apply(value);try{await AsyncStorage.setItem(KEY,JSON.stringify(preferences));}catch{}}
export function useInternational(){const current=useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getInternational,getInternational);return {...current,t:tr,money,date,setInternational};}
