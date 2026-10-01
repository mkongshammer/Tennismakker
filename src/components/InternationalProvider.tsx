'use client';
import {createContext,useContext} from 'react';
import {phrase} from '../lib/phrases';
import {formatMoney,formatDate} from '../lib/international';
import type {Locale} from '../lib/sports';
type Value={country:string;locale:Locale;currency:string;timeZone:string};
const Context=createContext<Value>({country:'DK',locale:'da',currency:'DKK',timeZone:'Europe/Copenhagen'});
export function InternationalProvider({locale,country='DK',currency='DKK',timeZone='Europe/Copenhagen',children}:{locale:Locale;country?:string;currency?:string;timeZone?:string;children:React.ReactNode}){return <Context.Provider value={{country,locale,currency,timeZone}}>{children}</Context.Provider>;}
export function useWebsiteInternational(){const value=useContext(Context);return {...value,tr:(text:string,params?:Record<string,string|number>)=>phrase(text,value.locale,params),money:(amount:number,currency=value.currency)=>formatMoney(amount,currency,value.locale),date:(instant:Date|string,options?:Intl.DateTimeFormatOptions)=>formatDate(instant,value.locale,value.timeZone,options)};}
