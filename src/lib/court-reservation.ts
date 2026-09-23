import {db} from './db';
import type {Prisma} from '@prisma/client';
export class CourtReservationConflict extends Error {}
export async function createCourtReservation(args:{data:Prisma.BookingUncheckedCreateInput}) {
 const {courtId,startsAt,endsAt}=args.data;
 if(!courtId)return db.booking.create(args);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Court" WHERE id=${courtId} FOR UPDATE`;
  const where={courtId,startsAt:{lt:new Date(endsAt)},endsAt:{gt:new Date(startsAt)}};
  if(await tx.booking.findFirst({where:{...where,OR:[{status:'CONFIRMED'},{status:'HOLD',OR:[{checkoutParams:{not:null}},{holdExpiresAt:null},{holdExpiresAt:{gt:new Date()}}]}]}})||await tx.externalBusy.findFirst({where}))throw new CourtReservationConflict('Tiden er netop blevet optaget. Vælg en anden tid.');
  return tx.booking.create(args);
 });
}
