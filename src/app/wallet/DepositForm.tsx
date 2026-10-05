'use client';
import {UiText} from "../../components/InternationalProvider";
import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { useState } from 'react';
import { depositWallet } from '../../lib/wallet-actions';
import { walletCredit, moneyOre, type WalletTier } from '../../lib/wallet-policy';
import { SubmitButton } from '../../components/SubmitButton';
export function DepositForm({ tiers }: {tiers: WalletTier[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(depositWallet, null),[amount, setAmount] = useState('1800');
  let quote = '';try {quote = money(walletCredit(moneyOre(amount), tiers) / 100);} catch {}
  return <form action={action} className="card space-y-4"><label className="label">{tr("Indbetal bel\xF8b (")}{currency})<input className="input" type="number" step="0.01" min="10" max="10000" required name="amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>{quote && <p>{tr("Du f\xE5r") + " "}<strong>{quote}</strong>{" " + tr("i bookingkredit.")}</p>}<p className="text-sm text-slate">{tr("Kredit bruges automatisk til banebookinger i din klub, n\xE5r saldoen d\xE6kker hele bel\xF8bet. Ellers \xE5bnes almindelig betaling. Aflyser du mindst 24 timer f\xF8r, f\xE5r du kreditten tilbage p\xE5 din wallet. Kredit kan ikke overf\xF8res til en anden klub.")}</p><SubmitButton pendingText={tr("\xC5bner betaling\u2026")}>{tr("Forts\xE6t til betaling")}</SubmitButton>{state?.error && <p role="alert">{<UiText text={state.error}/>}</p>}</form>;
}
