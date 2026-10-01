// Refresh country data during builds; never send visitor IPs to this provider.
import { mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Reader } from 'maxmind';
const month = new Date().toISOString().slice(0,7);
try {
  const response = await fetch(`https://download.db-ip.com/free/dbip-country-lite-${month}.mmdb.gz`, {signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const compressed = Buffer.from(await response.arrayBuffer());
  if (compressed.length > 20_000_000) throw Error('Unexpected database size');
  const buffer = gunzipSync(compressed,{maxOutputLength:30_000_000});
  const reader = new Reader(buffer);
  if (!reader.get('8.8.8.8')?.country?.iso_code || Date.now()-reader.metadata.buildEpoch.getTime()>62*86400000) throw Error('Invalid or outdated country database');
  mkdirSync('data',{recursive:true});writeFileSync('data/ip-country.mmdb',buffer);
  console.log(`IP country database refreshed (${month}).`);
} catch (error) {console.warn(`IP country refresh unavailable (${error.message}); using packaged offline data or asking for country.`);}
