import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadIsolatedModule } from './testing/isolated-module';
import * as navigation from './admin-navigation';
import * as sports from './sports';
import * as clubSports from './club-sports';
import * as dates from 'date-fns';

function fixture(role: string | null = 'CLUB_ADMIN') {
  const queries: string[] = [];
  const file = 'src/app/admin/AdminPageContent.tsx';
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), 99, true, ts.ScriptKind.TSX);
  const mocks: Record<string, any> = {};
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const key = (statement.moduleSpecifier as any).text;
    mocks[key] ??= {};
    const clause = statement.importClause;
    if (clause?.name) mocks[key] = clause.name.text;
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const item of clause.namedBindings.elements) mocks[key][item.name.text] = item.name.text;
    }
  }
  const club = {id:'club-a', name:'Test club', slug:'test-club', sports:'BADMINTON', integrationType:'MANUAL', courts:[], members:[], posts:[], images:[], people:[], subscriptionStatus:'active', priceHour:100};
  const db: any = { club: {findUnique: async ({where}: any) => { assert.equal(where.id, 'club-a'); return club; }} };
  for (const model of ['seasonTeam','clubPunchCard','clubSystemLogin','priceRule','membershipType','fixedSlot','clubControl','booking','payment','guestRule','guestSlot']) {
    db[model] = {findMany: async () => {queries.push(model);return [];}, findUnique: async () => {queries.push(model);return null;}};
  }
  Object.assign(mocks, {
    react: React, 'date-fns': dates, 'date-fns/locale': {},
    '../../lib/admin-navigation': navigation, '../../lib/sports': sports, '../../lib/club-sports': clubSports,
    '../../lib/db': {db}, '../../lib/session': {getCurrentUser:async()=>role ? {role,clubId:'club-a'} : null},
    '../../lib/settings': {getSettings:async()=>({commissionPct:0.1})},
    '../../lib/stripe': {stripeEnabled:async()=>true}, '../../lib/billing': {subscriptionIsActive:()=>true},
    '../../lib/integrations/types': {INTEGRATION_LABELS:{MANUAL:'Manual'}},
    '../../lib/system-blocks': {blockSummary:async()=>null}, '../../lib/connect':{refreshAccountStatus:async()=>{}},
    'next/navigation': {redirect:(path:string)=>{throw Error(`redirect:${path}`);}},
  });
  return {run:loadIsolatedModule(file,mocks).default,queries};
}
function componentNames(node:any): string[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(componentNames);
  return [typeof node.type === 'string' ? node.type : '', ...componentNames(node.props?.children)];
}
const forms: Record<string,string[]> = {
  oversigt:[], bookinger:['FixedSlotForm'], tider:['ReleaseForm','RuleForm'], medlemmer:['MembershipForm'], hold:['TeamForm'], nyheder:['PostForm'], baner:['CourtForm'],
  'lys-adgang':['ClubControlPanel'], priser:['PriceRuleForm','PunchCardForm'], betaling:[], integrationer:['IntegrationForm','SystemLoginForm'], hjemmeside:['SiteForm','DomainForm','ImageForms'], indstillinger:['AdminsForm','PeopleForm'],
};
for(const page of navigation.ADMIN_PAGES) test(`admin page ${page.id} renders only its own tools`, async()=>{
  const f=fixture(); const tree=await f.run({section:page.id,searchParams:Promise.resolve({})});
  const names=componentNames(tree);
  for(const [section,expected] of Object.entries(forms)) for(const name of expected) assert.equal(names.includes(name),section===page.id,`${page.id}: ${name}`);
  if(page.id==='lys-adgang') assert.deepEqual(f.queries,['clubControl']);
  if(page.id==='baner') assert.deepEqual(f.queries,[]);
});
test('unknown admin routes are not accepted',()=>{
  assert.equal(navigation.isAdminSection('../superadmin'),false);
  assert.equal(navigation.isAdminSection('unknown'),false);
});
test('admin subpages still require a club administrator',async()=>{
  const f=fixture('PLAYER'); const tree=await f.run({section:'lys-adgang',searchParams:Promise.resolve({})});
  assert.equal(componentNames(tree).includes('ClubControlPanel'),false); assert.deepEqual(f.queries,[]);
  await assert.rejects(fixture(null).run({section:'baner',searchParams:Promise.resolve({})}),/redirect:\/login/);
});
test('legacy payment callback reaches the payment page with its query',async()=>{
  await assert.rejects(fixture().run({searchParams:Promise.resolve({stripe:'return'})}),/redirect:\/admin\/betaling\?stripe=return/);
});
