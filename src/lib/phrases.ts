import {translatePhrase} from '../../shared/phrase-translation.mjs';
import type {Locale} from './sports';
export function phrase(value:string,locale:Locale='da',params:Record<string,string|number>={}){return translatePhrase(value,locale,params);}
