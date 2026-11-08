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
// App-only wording for the US app (English and Spanish), checked before the shared dictionary.
const APP_PHRASES={
 'Finding players…':{en:'Finding players…',es:'Buscando jugadores…'},
 'FIND A HITTING PARTNER':{en:'FIND A HITTING PARTNER',es:'ENCUENTRA COMPAÑERO DE JUEGO'},
 'Who do you want to play with?':{en:'Who do you want to play with?',es:'¿Con quién quieres jugar?'},
 'Where':{en:'Where',es:'Dónde'},
 'City or area':{en:'City or area',es:'Ciudad o zona'},
 'Clear':{en:'Clear',es:'Borrar'},
 'All sports':{en:'All sports',es:'Todos los deportes'},
 'Any level':{en:'Any level',es:'Cualquier nivel'},
 'Around my level':{en:'Around my level',es:'Cerca de mi nivel'},
 'Open games':{en:'Open games',es:'Partidos abiertos'},
 '+ Post a game':{en:'+ Post a game',es:'+ Publicar partido'},
 'Level':{en:'Level',es:'Nivel'},
 'Your post':{en:'Your post',es:'Tu publicación'},
 "I'm in":{en:"I'm in",es:'Me apunto'},
 'No open games here yet':{en:'No open games here yet',es:'Aún no hay partidos abiertos aquí'},
 'Post one in 20 seconds and players nearby can join.':{en:'Post one in 20 seconds and players nearby can join.',es:'Publica uno en 20 segundos y los jugadores cercanos podrán unirse.'},
 'Players in':{en:'Players in',es:'Jugadores en'},
 'Players near you':{en:'Players near you',es:'Jugadores cerca de ti'},
 'No players match yet':{en:'No players match yet',es:'Aún no hay jugadores que coincidan'},
 'Try another area or sport, or post a game so players can find you.':{en:'Try another area or sport, or post a game so players can find you.',es:'Prueba otra zona o deporte, o publica un partido para que te encuentren.'},
 'Coach':{en:'Coach',es:'Entrenador'},
 'Message':{en:'Message',es:'Mensaje'},
 'Something went wrong':{en:'Something went wrong',es:'Algo salió mal'},
 'Sikkerhed':{en:'Security',es:'Seguridad'},
 'Træningsmakker':{en:'Hitting partner',es:'Compañero de práctica'},
 'Glemt adgangskode':{en:'Forgot password?',es:'¿Olvidaste tu contraseña?'},
 'Send nulstillingslink':{en:'Send reset link',es:'Enviar enlace para restablecer'},
 'Language':{en:'Language',es:'Idioma'},
 'No messages yet. Say hi!':{en:'No messages yet. Say hi!',es:'Aún no hay mensajes. ¡Saluda!'},
 'City, state or ZIP':{en:'City, state or ZIP',es:'Ciudad, estado o código postal'},
};
export function tr(text,params){const own=APP_PHRASES[text];if(own){const value=preferences.locale==='es'?own.es:own.en;return params?value.replace(/\{(\w+)\}/g,(m,k)=>params[k]??m):value;}return translatePhrase(text,preferences.locale,params);}
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
