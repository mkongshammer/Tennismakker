'use client';
// Guests, waiver and check-in: the rules that apply to every court booking.
import { useFormState, useFormStatus } from 'react-dom';
import { useWebsiteInternational } from '../../components/InternationalProvider';
import { saveBookingRules } from '../../lib/booking-rules-actions';

function Save({ children }: { children: React.ReactNode }) { const { pending } = useFormStatus(); return <button className="btn-court" disabled={pending}>{children}</button>; }

export function BookingRulesForm({ club }: { club: { guestFeeKr: number; guestMax: number; waiverText: string | null; checkInEnabled: boolean; noShowReleaseMinutes: number } }) {
  const { tr, currency } = useWebsiteInternational();
  const [state, action] = useFormState(saveBookingRules, null);
  return (
    <section className="card space-y-4">
      <div>
        <h2 className="display text-2xl">{tr('Gæster, ansvarsfraskrivelse og check-in')}</h2>
        <p className="mt-1 text-sm text-slate">{tr('Gælder alle banebookinger hos jer.')}</p>
      </div>
      <form action={action} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label block">{tr('Gæstegebyr pr. gæst')} ({currency})<input className="input" name="guestFeeKr" type="number" min={0} max={1000} defaultValue={club.guestFeeKr} /><span className="hint">{tr('Et medlem kan tage gæster med på sin booking. 0 = gratis.')}</span></label>
          <label className="label block">{tr('Højst gæster pr. booking')}<input className="input" name="guestMax" type="number" min={0} max={10} defaultValue={club.guestMax} /><span className="hint">{tr('0 = ingen gæster.')}</span></label>
        </div>
        <label className="label block">{tr('Ansvarsfraskrivelse (waiver)')}<textarea className="input min-h-40" name="waiverText" maxLength={8000} defaultValue={club.waiverText ?? ''} placeholder={tr('Indsæt klubbens tekst. Tom = ingen waiver.')} /><span className="hint">{tr('Spillere accepterer den én gang, før de kan booke. Ændrer I teksten, skal alle acceptere igen. Dato og version gemmes.')}</span></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="checkInEnabled" defaultChecked={club.checkInEnabled} className="mt-1" /><span><span className="font-semibold">{tr('Check-in')}</span><br /><span className="text-slate">{tr('Spilleren tjekker ind på profilen eller i appen fra 30 minutter før starttid. I kan se, hvem der dukkede op.')}</span></span></label>
          <label className="label block">{tr('Frigiv banen uden check-in efter (minutter)')}<input className="input" name="noShowReleaseMinutes" type="number" min={0} max={60} defaultValue={club.noShowReleaseMinutes} /><span className="hint">{tr('0 = aldrig. Fx 15: er der ikke tjekket ind 15 minutter efter start, bliver timen ledig igen. Betalingen refunderes ikke.')}</span></label>
        </div>
        <div className="flex items-center gap-3">
          <Save>{tr('Gem regler')}</Save>
          {state?.error && <p role="alert" className="text-sm font-semibold text-[#a2401c]">{tr(state.error)}</p>}
          {state?.ok && <p role="status" className="text-sm font-semibold text-success">{tr(state.ok)}</p>}
        </div>
      </form>
    </section>
  );
}
