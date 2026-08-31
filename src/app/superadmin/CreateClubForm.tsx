"use client";

import { useSearchParams } from "next/navigation";
import { useFormState } from "react-dom";
import { createClubAsAdmin } from "../../lib/actions";
import { SubmitButton } from "../../components/SubmitButton";

// Formularen der reelt opretter en klub. Kun tilgængelig herfra, aldrig
// offentligt — se begrundelsen i submitClubLead/createClubAsAdmin.
export function CreateClubForm() {
  const [state, action] = useFormState(createClubAsAdmin, null);
  const params = useSearchParams();

  // Kommer man hertil fra en henvendelse, er felterne udfyldt på forhånd
  const leadId = params.get("leadId") ?? "";
  const clubName = params.get("clubName") ?? "";
  const city = params.get("city") ?? "";
  const adminName = params.get("adminName") ?? "";
  const adminEmail = params.get("adminEmail") ?? "";

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="leadId" value={leadId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="clubName">Klubbens navn</label>
          <input className="input" id="clubName" name="clubName" defaultValue={clubName} required />
        </div>
        <div>
          <label className="label" htmlFor="city">By</label>
          <input className="input" id="city" name="city" defaultValue={city} required />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="address">Adresse (til kortet)</label>
        <input className="input" id="address" name="address" placeholder="fx Tennisvej 12" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="courtCount">Antal baner</label>
          <input className="input" id="courtCount" name="courtCount" type="number" min={1} max={40} defaultValue={4} required />
        </div>
        <div>
          <label className="label" htmlFor="priceHour">Gæstepris pr. time</label>
          <input className="input" id="priceHour" name="priceHour" type="number" min={0} defaultValue={100} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="externalSystem">Deres bookingsystem</label>
          <input className="input" id="externalSystem" name="externalSystem" placeholder="fx Halbooking" />
        </div>
        <div>
          <label className="label" htmlFor="billingModel">Aftale</label>
          <select className="input" id="billingModel" name="billingModel" defaultValue="COMMISSION">
            <option value="COMMISSION">10% provision</option>
            <option value="SUBSCRIPTION">199 kr/md abonnement</option>
          </select>
        </div>
      </div>

      <div className="border-t border-slate/10 pt-4">
        <p className="mb-3 font-bold">Administratorens konto</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="adminName">Navn</label>
            <input className="input" id="adminName" name="adminName" defaultValue={adminName} required />
          </div>
          <div>
            <label className="label" htmlFor="adminEmail">E-mail</label>
            <input className="input" id="adminEmail" name="adminEmail" type="email" defaultValue={adminEmail} required />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate">
          En midlertidig adgangskode genereres og sendes automatisk på mail.
        </p>
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      <SubmitButton pendingText="Opretter…">Opret klub</SubmitButton>
    </form>
  );
}
