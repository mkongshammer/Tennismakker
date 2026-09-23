'use client';
import {useFormState} from 'react-dom';
import {useState} from 'react';
import {depositWallet} from '../../lib/wallet-actions';
import {walletCredit,moneyOre,type WalletTier} from '../../lib/wallet-policy';
import {SubmitButton} from '../../components/SubmitButton';
export function DepositForm({tiers}:{tiers:WalletTier[]}) {
 const [state,action]=useFormState(depositWallet,null),[amount,setAmount]=useState('1800');
 let quote='';try{quote=(walletCredit(moneyOre(amount),tiers)/100).toLocaleString('da-DK',{minimumFractionDigits:2});}catch{}
 return <form action={action} className="card space-y-4"><label className="label">Indbetal beløb (kr.)<input className="input" type="number" step="0.01" min="10" max="10000" required name="amount" value={amount} onChange={e=>setAmount(e.target.value)}/></label>{quote&&<p>Du får <strong>{quote} kr.</strong> i bookingkredit.</p>}<p className="text-sm text-slate">Kredit bruges automatisk til banebookinger i din klub, når saldoen dækker hele beløbet. Ellers åbnes almindelig betaling. Aflyser du mindst 24 timer før, får du kreditten tilbage på din wallet. Kredit kan ikke overføres til en anden klub.</p><SubmitButton pendingText="Åbner betaling…">Fortsæt til betaling</SubmitButton>{state?.error&&<p role="alert">{state.error}</p>}</form>;
}
