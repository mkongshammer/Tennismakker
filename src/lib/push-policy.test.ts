import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingPush,reminderWindow,validExpoToken,retryDelay} from './push-policy';
test('booking notifications avoid expired unpaid holds and route coach requests',()=>{
 assert.equal(bookingPush('CANCELLED','HOLD',false),null);
 assert.equal(bookingPush('REQUESTED',null,false),null);
 assert.equal(bookingPush('REQUESTED',null,true)?.category,'coaching');
 assert.equal(bookingPush('HOLD','REQUESTED',false)?.category,'coaching');
 assert.equal(bookingPush('CANCELLED','CONFIRMED',false)?.category,'bookings');
 assert.equal(bookingPush('CONFIRMED','HOLD',false)?.category,'bookings');
});
test('reminders have bounded catch-up windows, never notify after start',()=>{
 const now=new Date('2026-09-22T10:00:00Z');
 const at=(minutes:number)=>new Date(+now+minutes*60000);
 assert.equal(reminderWindow(at(60),now)?.key,'1h');
 assert.equal(reminderWindow(at(46),now)?.key,'1h');
 assert.equal(reminderWindow(at(45),now),null);
 assert.equal(reminderWindow(at(1440),now)?.key,'24h');
 assert.equal(reminderWindow(at(1425),now),null);
 assert.equal(reminderWindow(at(-1),now),null);
});
test('only Expo tokens accepted and retries capped',()=>{
 assert.equal(validExpoToken('ExpoPushToken[abcdefghijklmnop]'),true);
 assert.equal(validExpoToken('https://attacker.test'),false);
 assert.equal(validExpoToken({token:'fake'}),false);
 assert.equal(retryDelay(100),3600000);
});
