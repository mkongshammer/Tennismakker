import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MARKETS} from './international';
import {termsRegionForCountry,termsHref} from './legal-market';
import {termsContent} from './terms-content';
test('all offered countries have a concrete terms document',()=>{for(const market of MARKETS){assert.ok(termsRegionForCountry(market.code),market.code);assert.notEqual(termsHref(market.code),'/vilkaar');}for(const country of ['GB','CH','CA'])assert.equal(termsHref(country),'/vilkaar/international');assert.equal(termsRegionForCountry('ZZ'),null);});
test('international terms retain local rights and show the quoted billing currency',()=>{const content=termsContent('international','en',{standard:30,custom:2249,currency:'USD'});assert.ok(content.some(s=>s.id==='local-rights'));assert.ok(!content.some(s=>s.id==='us-rights'||s.id==='consumer-rights'));assert.ok(content.some(s=>s.id==='law'));assert.match(JSON.stringify(content),/USD/);assert.match(JSON.stringify(content),/provincial and territorial/);});
