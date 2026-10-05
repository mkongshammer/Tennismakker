import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {T} from './i18n';
import {phrase} from './phrases';
import localized from '../../shared/localized-phrases.json';
import {ADMIN_PAGES} from './admin-navigation';
import {CLUB_MODULES} from './club-custom';
test('every fixed club administration phrase has complete supported-language translations',()=>{
 const dictionary:Record<string,Record<string,string>>={...Object.fromEntries(Object.values(T).map(v=>[v.da,v])),...localized};
 const values=new Set<string>([...ADMIN_PAGES.flatMap(p=>[p.label,p.description,p.group]),...CLUB_MODULES.flatMap(p=>[p.label,p.description])]);
 const files=readdirSync('src/app/admin').filter(f=>f.endsWith('.tsx')).map(f=>'src/app/admin/'+f);
 files.push('src/components/CountryLocation.tsx');
 files.push('src/components/BlockedFirst.tsx');
 files.push('src/app/admin/custom/page.tsx');
 for(const file of files){const source=ts.createSourceFile(file,readFileSync(file,'utf8'),99,true,ts.ScriptKind.TSX);function visit(n:ts.Node){if(ts.isCallExpression(n)&&['tr','phrase'].includes(n.expression.getText(source))&&ts.isStringLiteral(n.arguments[0]))values.add(n.arguments[0].text);ts.forEachChild(n,visit);}visit(source);}
 for(const value of values)for(const locale of ['en','de','sv','no','fr','es'])assert.ok(dictionary[value]?.[locale],`${locale}: ${value}`);
});
test('admin navigation, dates and parameterised statuses follow the chosen language',()=>{
 assert.equal(phrase('Lys og adgang','de'),'Licht und Zugang');assert.equal(phrase('Medlemmer','sv'),'Medlemmar');
 assert.equal(phrase('Administratorer og kontakt','no'),'Administratorer og kontakter');assert.equal(phrase('Lys og adgang','en-US'),'Lights and access');
 assert.equal(phrase('Fornyes {date}.','de',{date:'2. Oktober'}),'Verlängert sich am 2. Oktober.');
 assert.equal(phrase('Fornyes {date}.','da',{date:'2. oktober'}),'Fornyes 2. oktober.');
});
test('server action messages preserve names, counts and identifiers while translating the complete status',()=>{
 assert.equal(phrase('Bane 1 er oprettet.','de'),'Bane 1 wurde erstellt.');
 assert.equal(phrase('12 tider frigivet til gæster.','sv'),'12 tider släppta för gäster.');
 assert.equal(phrase('Række 3: kontrollér type og e-mail.','en'),'Row 3: check type and email.');
 assert.equal(phrase('Senior — Sommer er oprettet og åben for tilmelding.','no'),'Senior — Sommer er opprettet og åpent for påmelding.');
 assert.equal(phrase('Custom user text','de'),'Custom user text');
 assert.equal(phrase('Confirm that Resasports uses your venue time zone.','da'),'Bekræft, at Resasports bruger klubbens tidszone.');
});
