export type WalletTier={paidOre:number;creditOre:number};
export function walletCredit(paidOre:number,tiers:WalletTier[]) {
  if(!Number.isSafeInteger(paidOre)||paidOre<1000||paidOre>1000000)throw Error('Indbetal mellem 10 og 10.000 kr.');
  let result=paidOre;
  for(const t of tiers) {
    if(!Number.isSafeInteger(t.paidOre)||!Number.isSafeInteger(t.creditOre)||t.paidOre<1000||t.creditOre<t.paidOre||t.creditOre>t.paidOre*2)throw Error('Ugyldigt rabattrin. Bonus skal være mellem 0 og 100 %.');
    if(paidOre>=t.paidOre)result=Math.max(result,Math.floor(paidOre*t.creditOre/t.paidOre));
  }
  return result;
}
export function moneyOre(value:unknown) {
  const raw=String(value??'').trim().replace(',','.');
  if(!/^\d+(\.\d{1,2})?$/.test(raw))throw Error('Skriv et beløb med højst to decimaler.');
  const amount=Math.round(Number(raw)*100);if(!Number.isSafeInteger(amount))throw Error('Ugyldigt beløb.');return amount;
}
