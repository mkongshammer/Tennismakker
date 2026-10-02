'use server';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { getCurrentUser } from './session';
import { marketFor, validSalesCurrency, validCurrency, validTimeZone } from './international';

export async function saveClubInternational(_prev: unknown, form: FormData): Promise<{ok?: string; error?: string}> {
  try {
    const user = await getCurrentUser();
    if (user?.role !== 'CLUB_ADMIN' || !user.clubId) throw Error('Ingen adgang.');
    const country = String(form.get('country') ?? ''), currency = String(form.get('currency') ?? ''), timeZone = String(form.get('timeZone') ?? '');
    const market = marketFor(country), priceHour = Number(form.get('priceHour'));
    if (!market || !validCurrency(currency) || !validTimeZone(timeZone) || !Number.isSafeInteger(priceHour) || priceHour < 0 || priceHour > 10000) throw Error('Vælg gyldigt land, valuta, tidszone og pris.');
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Club" WHERE id=${user.clubId} FOR UPDATE`;
      const club = await tx.club.findUniqueOrThrow({where:{id:user.clubId!}});
      if (country !== club.country && club.stripeAccountId) throw Error('Landet på en tilknyttet Stripe-konto kan ikke ændres her. Kontakt RacketBuddy.');
      if (currency !== club.currency) {
        if(!validSalesCurrency(currency))throw Error('Choose EUR or USD.');
        if (form.get('reviewedPrices') !== 'on') throw Error('Bekræft den nye pris i den valgte valuta.');
        const used = await Promise.all([
          tx.booking.count({where:{court:{clubId:club.id}}}), tx.clubWallet.count({where:{clubId:club.id}}), tx.walletTopup.count({where:{clubId:club.id}}),
          tx.membershipType.count({where:{clubId:club.id}}), tx.seasonTeam.count({where:{clubId:club.id}}), tx.clubPunchCard.count({where:{clubId:club.id}}),
          tx.priceRule.count({where:{clubId:club.id}}), tx.guestSlot.count({where:{court:{clubId:club.id}}}), tx.guestRule.count({where:{clubId:club.id}}),
          tx.court.count({where:{clubId:club.id,OR:[{priceHour:{not:null}},{memberPriceHour:{not:null}}]}}),
        ]);
        if (used.some(Boolean) || club.memberPriceHour !== null) throw Error('Valutaen er låst, fordi klubben allerede har priser, bookinger eller kredit. Kontakt RacketBuddy for en afstemt overgang.');
      }
      await tx.club.update({where:{id:club.id},data:{country:market.code,currency,timeZone,priceHour,...(country !== club.country ? {latitude:null,longitude:null} : {})}});
    });
    revalidatePath('/','layout');
    return {ok:'Land, valuta og tidszone er gemt. Eksisterende bookingtidspunkter bevares.'};
  } catch (error) { return {error:error instanceof Error ? error.message : 'Indstillinger kunne ikke gemmes.'}; }
}
