import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGES,marketFor,formatMoney} from '../../../shared/international.mjs';
import {translatePhrase} from '../../../shared/phrase-translation.mjs';
import translations from '../../../shared/translations.json' with {type:'json'};
test('mobile shared language choices, sports, prices and base messages cover French and Spanish',()=>{
 for(const locale of ['fr','es']){assert.ok(LANGUAGES.includes(locale));for(const entry of Object.values(translations))assert.ok(entry[locale]);assert.match(formatMoney(27,'EUR',locale),/EUR/);assert.match(formatMoney(30,'USD',locale),/USD/);assert.notEqual(translatePhrase('Log ind på klubben',locale),'Log ind på klubben');}
 assert.equal(marketFor('FR').defaultLocale,'fr');assert.equal(marketFor('ES').defaultLocale,'es');
 assert.equal(translatePhrase('Tennis','es'),'Tenis');assert.equal(translatePhrase('Bordtennis','fr'),'Tennis de table');
 assert.equal(translatePhrase('A player’s own text','fr'),'A player’s own text');
});
