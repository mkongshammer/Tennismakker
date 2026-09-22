import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { loadIsolatedModule } from './testing/isolated-module';
import * as navigation from './superadmin-navigation';
function fixture(role: string | null = 'SUPERADMIN') {
  const queries:string[]=[];
  const mocks:any={
    react:React,'next/link':'Link','next/navigation':{redirect:(path:string)=>{throw Error(`redirect:${path}`);}},
    '../../lib/session':{getCurrentUser:async()=>role?{role}:null},
    '../../lib/settings':{getSettings:async()=>{queries.push('settings');return {commissionPct:0.1};}},
    '../../lib/db':{db:Object.fromEntries(['club','clubLead','websiteOrder'].map(model=>[model,{findMany:async()=>{queries.push(model);return [];}}]))},
    '../../lib/superadmin-navigation':navigation,'../../lib/billing':{},'date-fns':{},'date-fns/locale':{},'../../lib/actions':{},'../../lib/sports':{},
  };
  for(const name of ['SuperadminAccess','Overblik','Aktivitet','CoachPhotos','Oekonomi','CreateClubForm'])mocks[`./${name}`]={[name]:name};
  mocks['./OrderTools']={DomainForm:'DomainForm'};
  return {run:loadIsolatedModule('src/app/superadmin/SuperadminPageContent.tsx',mocks).default,queries};
}
function types(node:any):string[] {
 if(!node || typeof node!=='object')return [];
 if(Array.isArray(node))return node.flatMap(types);
 return [node.type,...types(node.props?.children)].filter(x=>typeof x==='string');
}
test('superadmin rejects other roles before querying administrative data',async()=>{
 for(const role of [null,'PLAYER','CLUB_ADMIN']){
  const f=fixture(role);
  if(!role)await assert.rejects(f.run({section:'klubber'}),/redirect:\/login/);
  else assert.ok(!types(await f.run({section:'adgang'})).includes('SuperadminAccess'));
  assert.deepEqual(f.queries,[]);
 }
});
test('superadmin pages load only their own data and forms',async()=>{
 const expected:Record<string,string[]>={klubber:['settings','club','club'],henvendelser:['clubLead'],hjemmesider:['websiteOrder'],domaener:['club']};
 const components:Record<string,string>={oversigt:'Overblik',aktivitet:'Aktivitet',traenere:'CoachPhotos',oekonomi:'Oekonomi',adgang:'SuperadminAccess','opret-klub':'CreateClubForm',domaener:'DomainForm'};
 for(const section of ['oversigt','klubber','henvendelser','hjemmesider','domaener','aktivitet','traenere','oekonomi','adgang','opret-klub']){
  const f=fixture();const tree=await f.run({section});
  assert.deepEqual(f.queries,expected[section]??[],section);
  const found=types(tree);
  for(const [owner,component] of Object.entries(components))assert.equal(found.includes(component),owner===section,`${section}: ${component}`);
 }
});
test('unknown superadmin routes are not accepted',()=>{
 assert.equal(navigation.isSuperadminSection('unknown'),false);
 assert.equal(navigation.isSuperadminSection('../adgang'),false);
 assert.equal(navigation.superadminHref('opret-klub'),'/superadmin/opret-klub');
});
