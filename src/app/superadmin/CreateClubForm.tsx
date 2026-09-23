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

      <label className="label" htmlFor="solutionMode">Klubløsning</label>
      <select className="input" id="solutionMode" name="solutionMode" defaultValue="STANDARD"><option value="STANDARD">Standard · gæstebooking</option><option value="CUSTOM">Custom · fuld klubadministration</option></select>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="privateSetup" className="mt-1" defaultChecked />
        <span>Hold klubben skjult under opsætning. Den vises først for spillere, når du godkender den.</span>
      </label>

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
        <label className="label mt-4" htmlFor="loginDelivery">Udlevering af login</label>
        <select id="loginDelivery" name="loginDelivery" className="input" defaultValue="screen">
          <option value="screen">Vis login her — send ingen mail</option>
          <option value="email">Send login til administratoren på mail</option>
        </select>
      </div>

      {state?.error && <p className="text-sm font-semibold text-court">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-court">{state.ok}</p>}
      {state?.login && <div className="rounded-xl border border-court/20 bg-mist p-4 space-y-2">
        <p className="font-bold">Klubadministratorens login</p>
        <p className="text-sm">Gem oplysningerne nu. Adgangskoden vises kun efter oprettelsen.</p>
        <p>E-mail: <span className="select-all">{state.login.email}</span></p>
        <p>Adgangskode: <code className="select-all break-all">{state.login.password}</code></p>
        <a className="btn-court inline-flex" href="/admin" target="_blank" rel="noreferrer">Åbn klubadministration</a>
        <p className="text-xs text-slate">Brug et separat privat browservindue til klublogin, så du beholder ejeradgangen her.</p>
      </div>}
      <SubmitButton pendingText="Opretter…">Opret klub</SubmitButton>
    </form>
  );
}
