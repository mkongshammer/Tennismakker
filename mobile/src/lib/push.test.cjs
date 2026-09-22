const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function setup() {
 let saved=null,registers=0,unregisters=0,fail=false,release;
 let gate=null;
 const mocks={
  'react-native':{Platform:{OS:'ios'}},'expo-constants':{expoConfig:{extra:{eas:{projectId:'test'}}}},
  '@react-native-async-storage/async-storage':{getItem:async()=>saved,setItem:async(_k,v)=>{saved=v;},removeItem:async()=>{saved=null;}},
  './api':{api:{registerPush:async()=>{registers++;if(gate)await gate;},unregisterPush:async()=>{unregisters++;if(fail)throw Error('Offline');}}},
  'expo-device':{isDevice:true},'expo-notifications':{getPermissionsAsync:async()=>({granted:true}),getExpoPushTokenAsync:async()=>({data:'ExpoPushToken[abcdefghijklmnop]'})}
 };
 const code=ts.transpileModule(fs.readFileSync(__dirname+'/push.js','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{if(!(name in mocks))throw Error(name);return mocks[name];},module,module.exports);
 return {api:module.exports,get saved(){return saved;},get registers(){return registers;},get unregisters(){return unregisters;},set fail(v){fail=v;},pause(){gate=new Promise(r=>{release=r;});},resume(){release();}};
}
test('push never opts in automatically and stays disabled after refresh',async()=>{
 const h=setup();await h.api.enablePush(false);assert.equal(h.registers,0);
 await h.api.enablePush(true);assert.equal(h.registers,1);
 await h.api.disablePush();assert.equal(h.saved,null);
 await h.api.enablePush(false);assert.equal(h.registers,1);
});
test('logout unregister waits for in-flight registration',async()=>{
 const h=setup();h.pause();const enable=h.api.enablePush(true);
 await new Promise(r=>setImmediate(r));
 const disable=h.api.disablePush();assert.equal(h.unregisters,0);
 h.resume();await Promise.all([enable,disable]);assert.equal(h.unregisters,1);assert.equal(h.saved,null);
});
test('failed unregister retains token so logout can retry',async()=>{
 const h=setup();await h.api.enablePush(true);h.fail=true;
 await assert.rejects(h.api.disablePush(),/Offline/);assert.ok(h.saved);
 h.fail=false;await h.api.disablePush();assert.equal(h.saved,null);
});
