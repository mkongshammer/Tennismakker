import test from 'node:test';
import assert from 'node:assert/strict';
import {dataRegionForCountry,deploymentRegion,regionalShardingActive,regionAllowsCountry} from './region';

function withEnv(values:Record<string,string|undefined>, fn:()=>void){
  const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
  try{
    for(const [key,value] of Object.entries(values)) value===undefined?delete process.env[key]:process.env[key]=value;
    fn();
  } finally {
    for(const [key,value] of Object.entries(previous)) value===undefined?delete process.env[key]:process.env[key]=value;
  }
}

test('US is isolated from all non-US markets',()=>{
  assert.equal(dataRegionForCountry('US'),'US');
  for(const country of ['DK','DE','FR','ES','GB','SE','NO','CA']) assert.equal(dataRegionForCountry(country),'EU');
});

test('sharding is fail-safe off until explicitly activated',()=>withEnv({REGIONAL_SHARDING_ACTIVE:undefined,RACKETBUDDY_REGION:'US'},()=>{
  assert.equal(regionalShardingActive(),false);
  assert.equal(regionAllowsCountry('DK'),true);
}));

test('US deployment only accepts US data when sharding is active',()=>withEnv({REGIONAL_SHARDING_ACTIVE:'true',RACKETBUDDY_REGION:'US'},()=>{
  assert.equal(deploymentRegion(),'US');
  assert.equal(regionAllowsCountry('US'),true);
  assert.equal(regionAllowsCountry('DK'),false);
}));

test('EU deployment rejects US data when sharding is active',()=>withEnv({REGIONAL_SHARDING_ACTIVE:'true',RACKETBUDDY_REGION:'EU'},()=>{
  assert.equal(deploymentRegion(),'EU');
  assert.equal(regionAllowsCountry('US'),false);
  assert.equal(regionAllowsCountry('DE'),true);
}));
