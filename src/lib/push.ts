import { db } from './db';
import { bookingPush, reminderWindow, retryDelay, type PushCategory } from './push-policy';

// Generic lock-screen copy: no names, message text, access codes or payment data.
async function enqueue(userId: string, key: string, category: PushCategory, title: string, body: string, data: object, expiresAt: Date, extra: {bookingId?:string;expectedStatus?:string;threadId?:string} = {}) {
  const prefs = await db.pushPreference.findUnique({where:{userId}});
  if (!prefs?.[category]) return;
  const devices = await db.pushDevice.findMany({where:{userId,expiresAt:{gt:new Date()}}});
  for(const device of devices) await db.pushDelivery.upsert({where:{deviceId_eventKey:{deviceId:device.id,eventKey:key}},update:{},create:{deviceId:device.id,eventKey:key,category,title,body,data:JSON.stringify({...data,recipientId:userId}),expiresAt,...extra}});
}
async function collectPushEvents(now:Date, deadline:number) {
  // Round-robin users with active installations; bounded work on the minute job.
  const prefs = await db.pushPreference.findMany({where:{user:{pushDevices:{some:{expiresAt:{gt:now}}}}},orderBy:{scannedAt:'asc'},take:100});
  for(const pref of prefs) {
    if(Date.now()>deadline) break;
    const userId=pref.userId;
    const bookings=await db.booking.findMany({where:{OR:[{userId},{coachProfile:{userId}}],endsAt:{gt:new Date(now.getTime()-86400000)}},include:{coachProfile:{select:{userId:true}}},orderBy:{startsAt:'asc'},take:100});
    for(const booking of bookings) {
      const prev=await db.pushBookingState.findUnique({where:{userId_bookingId:{userId,bookingId:booking.id}}});
      const isCoach=booking.userId!==userId;
      // First scan establishes a baseline; no flood of old confirmations.
      if ((!prev && booking.createdAt>=pref.enabledAt) || (prev && prev.status!==booking.status)) {
        const event=bookingPush(booking.status,prev?.status??null,isCoach);
        if(event) await enqueue(userId,`booking:${booking.id}:${booking.status}`,event.category,event.title,event.body,{screen:isCoach?'coach':'profile'},new Date(now.getTime()+86400000),{bookingId:booking.id,expectedStatus:booking.status});
      }
      if(prev && prev.startsAt.getTime()!==booking.startsAt.getTime() && booking.status==='CONFIRMED') await enqueue(userId,`rescheduled:${booking.id}:${booking.startsAt.toISOString()}`,'bookings','Din booking har fået en ny tid','Se det opdaterede tidspunkt i appen.',{screen:isCoach?'coach':'profile'},booking.startsAt,{bookingId:booking.id,expectedStatus:'CONFIRMED'});
      if(booking.status==='CONFIRMED') {
        const reminder=reminderWindow(booking.startsAt,now);
        if(reminder) await enqueue(userId,`reminder:${booking.id}:${booking.startsAt.toISOString()}:${reminder.key}`,'reminders',reminder.title,'Se tid og sted under dine bookinger.',{screen:isCoach?'coach':'profile'},booking.startsAt,{bookingId:booking.id,expectedStatus:'CONFIRMED'});
      }
      await db.pushBookingState.upsert({where:{userId_bookingId:{userId,bookingId:booking.id}},create:{userId,bookingId:booking.id,status:booking.status,startsAt:booking.startsAt},update:{status:booking.status,startsAt:booking.startsAt}});
    }
    if(pref.messages) {
      const messages=await db.message.findMany({where:{senderId:{not:userId},readAt:null,createdAt:{gte:new Date(Math.max(pref.enabledAt.getTime(),now.getTime()-86400000))},matchRequest:{OR:[{requesterId:userId},{acceptedById:userId}],acceptedById:{not:null}}},orderBy:{createdAt:'desc'},take:100});
      // At most one notification per conversation per five-minute window.
      const groups=new Map<string,typeof messages[number]>();
      for(const m of messages) groups.set(`${m.matchRequestId}:${Math.floor(m.createdAt.getTime()/300000)}`,m);
      for(const [key,m] of groups) await enqueue(userId,`message:${key}`,'messages','Ny besked','Du har en ulæst besked i RacketBuddy.',{screen:'thread',threadId:m.matchRequestId},new Date(m.createdAt.getTime()+86400000),{threadId:m.matchRequestId});
    }
    await db.pushPreference.update({where:{userId},data:{scannedAt:now}});
  }
}
async function expoRequest(path:string, body:object) {
  const response=await fetch(`https://exp.host/--/api/v2/push/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.EXPO_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_ACCESS_TOKEN}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok) throw new Error(`Expo HTTP ${response.status}`);
  return response.json();
}
async function deliverPush(now:Date, deadline:number) {
  await db.pushDelivery.updateMany({where:{state:'SENDING',nextAttemptAt:{lt:now}},data:{state:'PENDING'}});
  const pending=await db.pushDelivery.findMany({where:{state:'PENDING',nextAttemptAt:{lte:now}},orderBy:{createdAt:'asc'},take:25});
  let submitted=0;
  for(const item of pending) {
    if(Date.now()>deadline) break;
    const claim=await db.pushDelivery.updateMany({where:{id:item.id,state:'PENDING',nextAttemptAt:{lte:now}},data:{state:'SENDING',attempts:{increment:1},nextAttemptAt:new Date(now.getTime()+120000)}});
    if(!claim.count) continue;
    const device=await db.pushDevice.findUnique({where:{id:item.deviceId},include:{user:{include:{pushPreference:true}}}});
    let valid=Boolean(device && device.expiresAt>now && device.user.pushPreference?.[item.category as PushCategory] && item.expiresAt>now);
    const payload=JSON.parse(item.data);
    if(device?.userId!==payload.recipientId) valid=false;
    if(valid && item.bookingId) {
      const b=await db.booking.findUnique({where:{id:item.bookingId},include:{coachProfile:{select:{userId:true}}}});
      valid=Boolean(b && b.status===item.expectedStatus && (b.userId===device!.userId || b.coachProfile?.userId===device!.userId));
      if(b && item.category==='reminders' && !item.eventKey.includes(b.startsAt.toISOString())) valid=false;
    }
    if(valid && item.threadId) valid=(await db.message.count({where:{matchRequestId:item.threadId,readAt:null,senderId:{not:device!.userId},matchRequest:{acceptedById:{not:null},OR:[{requesterId:device!.userId},{acceptedById:device!.userId}]}}}))>0;
    if(!valid) { await db.pushDelivery.update({where:{id:item.id},data:{state:'SKIPPED'}}); continue; }
    try {
      const result=await expoRequest('send',{to:device!.token,title:item.title,body:item.body,data:payload,sound:'default',channelId:'racketbuddy',ttl:Math.max(1,Math.min(86400,Math.floor((item.expiresAt.getTime()-now.getTime())/1000)))});
      const ticket=result.data;
      if(ticket?.status==='ok' && ticket.id) {
        await db.pushDelivery.update({where:{id:item.id},data:{state:'SUBMITTED',receiptId:ticket.id,sentAt:now,error:null}});submitted++;
      } else {
        const error=ticket?.details?.error??'InvalidTicket';
        if(error==='DeviceNotRegistered') await db.pushDevice.deleteMany({where:{id:device!.id,token:device!.token}});
        else if(error==='MessageRateExceeded') throw Error(error);
        else await db.pushDelivery.update({where:{id:item.id},data:{state:'FAILED',error}});
      }
    } catch {
      await db.pushDelivery.updateMany({where:{id:item.id,state:'SENDING'},data:{state:item.attempts>=4?'FAILED':'PENDING',error:'Push submission failed',nextAttemptAt:new Date(now.getTime()+retryDelay(item.attempts))}});
    }
  }
  return submitted;
}
async function checkReceipts(now:Date) {
  const rows=await db.pushDelivery.findMany({where:{state:'SUBMITTED',receiptCheckedAt:null,sentAt:{lt:new Date(now.getTime()-15*60000)}},take:100});
  if(!rows.length)return;
  const result=await expoRequest('getReceipts',{ids:rows.map(r=>r.receiptId)});
  for(const row of rows) {
    const receipt=result.data?.[row.receiptId!];
    if(!receipt && row.sentAt!>new Date(now.getTime()-86400000))continue;
    if(receipt?.details?.error==='DeviceNotRegistered') await db.pushDevice.deleteMany({where:{id:row.deviceId}});
    else await db.pushDelivery.updateMany({where:{id:row.id},data:{receiptCheckedAt:now,state:receipt?.status==='ok'?'ACCEPTED':'FAILED',error:receipt?.details?.error??(receipt?'':'Receipt unavailable')}});
  }
}
export async function runPushNotifications() {
  const now=new Date();
  await collectPushEvents(now,Date.now()+10000);
  const submitted=await deliverPush(now,Date.now()+10000);
  await checkReceipts(now);
  await db.pushDevice.deleteMany({where:{expiresAt:{lt:now}}});
  await db.pushDelivery.deleteMany({where:{createdAt:{lt:new Date(now.getTime()-30*86400000)}}});
  await db.pushBookingState.deleteMany({where:{startsAt:{lt:new Date(now.getTime()-30*86400000)}}});
  return {submitted};
}
