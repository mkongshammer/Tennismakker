import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {loadIsolatedModule} from './testing/isolated-module';
test('app handoff is one-time and refuses expired tickets',async()=>{
 const ticket=crypto.randomBytes(32).toString('base64url');let row:any={userId:'u',destination:'/admin',expiresAt:new Date(Date.now()+60000)},sessions=0;
 const tx={appHandoff:{findUnique:async()=>row,deleteMany:async()=>{if(!row)return{count:0};row=null;return{count:1};}}};
 const {GET}=loadIsolatedModule('src/app/app-session/route.ts',{'node:crypto':crypto,'next/server':{NextResponse:{redirect:(url:URL)=>new Response(null,{status:307,headers:{location:String(url)}})}},'../../lib/session':{createSession:async()=>{sessions++;}},'../../lib/db':{db:{$transaction:async(fn:any)=>fn(tx),user:{findUnique:async()=>({id:'u',role:'CLUB_ADMIN',clubId:'c'})}}}});
 const req=()=>new Request(`https://racketbuddy.app/app-session?ticket=${ticket}`);
 assert.equal((await GET(req())).status,307);assert.equal((await GET(req())).status,401);assert.equal(sessions,1);
 row={userId:'u',destination:'/admin',expiresAt:new Date(Date.now()-1)};assert.equal((await GET(req())).status,401);assert.equal(sessions,1);
});
