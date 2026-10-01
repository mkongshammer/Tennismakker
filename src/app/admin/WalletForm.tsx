'use client';import { useWebsiteInternational } from "../../components/InternationalProvider";
import { useFormState } from 'react-dom';
import { saveWallet } from '../../lib/wallet-actions';
import { SubmitButton } from '../../components/SubmitButton';
export function WalletForm({ enabled, tiers }: {enabled: boolean;tiers: {paidOre: number;creditOre: number;}[];}) {const { tr, money, currency, timeZone } = useWebsiteInternational();
  const [state, action] = useFormState(saveWallet, null);
  return <section className="card space-y-4"><h2 className="display text-2xl">{tr("Klubwallet")}</h2><p className="text-sm text-slate">{tr("Medlemmer indbetaler et valgfrit bel\xF8b. Det bedste opn\xE5ede rabattrin g\xE6lder for hele indbetalingen. Eksempel: Betal") + " "}{money(1800)}{tr(", f\xE5") + " "}{money(2000)}{" " + tr("i bookingkredit. Kreditten bruges kun i jeres klub.")}</p><form action={action} className="space-y-4">
 <label className="flex gap-2"><input type="checkbox" name="enabled" defaultChecked={enabled} />{tr("\xC5bn for indbetalinger")}</label>
 {[0, 1, 2].map((i) => <div key={i} className="grid gap-3 sm:grid-cols-2"><label className="label">{tr("Indbetaling fra (")}{currency})<input className="input" name={`paid${i}`} type="number" min="10" step="0.01" defaultValue={tiers[i] ? tiers[i].paidOre / 100 : undefined} /></label><label className="label">{tr("Bookingv\xE6rdi ved denne indbetaling (")}{currency})<input className="input" name={`credit${i}`} type="number" min="10" step="0.01" defaultValue={tiers[i] ? tiers[i].creditOre / 100 : undefined} /></label></div>)}
 <p className="text-sm text-slate">{tr("Uden et rabattrin f\xE5r medlemmet samme bel\xF8b i kredit som indbetalingen. Eksisterende kredit bevares, n\xE5r nye indbetalinger sl\xE5s fra.")}</p><SubmitButton pendingText={tr("Gemmer\u2026")}>{tr("Gem wallet")}</SubmitButton></form>{state?.error && <p role="alert">{tr(state.error)}</p>}{state?.ok && <p>{tr(state.ok)}</p>}</section>;
}
