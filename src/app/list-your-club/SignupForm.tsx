"use client";
// Club self-service signup.
//
// One form, four steps, one submit. Every input stays mounted (hidden
// panels still post), each step validates itself before moving on, and a
// live preview on the right shows the club the way players will see it.
// Field names are the contract with registerClub() and are unchanged.
import { pricesForCountry, type PriceBook } from "../../lib/platform-pricing";
import { Select } from "../../components/ui/Select";
import { useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { registerClub } from "../../lib/club-onboarding-actions";
import { CUSTOM_FEATURES } from "../../lib/club-features";
import { SPORTS, sportLabel, sportColor, type Locale, type Sport } from "../../lib/sports";
import { formatMoney, usTimeZoneOptions } from "../../lib/international";
import { US_STATES, usStateTimeZone } from "../../../shared/us-address.mjs";
import { phrase } from "../../lib/phrases";
import { termsHref } from "../../lib/legal-market";
import { SubmitButton } from "../../components/SubmitButton";
import { Icon } from "../../components/ui";

const FEATURE_EN: Record<string, { label: string; body: string }> = {
  medlemmer: { label: "Members and memberships", body: "Plans, seasons, renewals, member pricing." },
  hold: { label: "Teams and clinics", body: "Season teams with sign-up and payment." },
  "lys-adgang": { label: "Lights and door access", body: "Bookings switch on lights and open doors." },
  priser: { label: "Wallet, pricing rules and punch cards", body: "Peak pricing, prepaid credit, bundles." },
  hjemmeside: { label: "Club website and contacts", body: "Your page on your own domain, photos, news." },
  nyheder: { label: "Club news", body: "Posts on your public page." },
  "faste-bookinger": { label: "Recurring reservations", body: "Same court, same weekday, all season." },
  import: { label: "Import from another system", body: "Members and bookings via CSV." },
  events: { label: "Events, tournaments and ladder", body: "Sign-up, payment, capacity and a club ladder." },
  kommunikation: { label: "Member emails and SMS", body: "One email to every member; text reminders." },
  butik: { label: "Pro shop and gift cards", body: "Front-desk register, stock, gift cards." },
  vagtplan: { label: "Staff schedule", body: "Shifts for desk and pros." },
  rapporter: { label: "Reports and accounting export", body: "Revenue by month and category; CSV and QuickBooks." },
};

const STEPS = ["Price", "Facility", "Courts", "Account"] as const;

export function SignupForm({ priceBook, locale = "en-US" }: { priceBook: PriceBook; locale?: Locale; initialCountry?: string; initialMode?: "STANDARD" | "CUSTOM" }) {
  const [sports, setSports] = useState<Sport[]>(["TENNIS"]);
  const [counts, setCounts] = useState<Record<string, number>>({ TENNIS: 2 });
  const [state, action] = useFormState(registerClub, null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [usState, setUsState] = useState("");
  const [timeZone, setTimeZone] = useState("America/New_York");
  const [priceHour, setPriceHour] = useState(30);
  const panels = useRef<Array<HTMLDivElement | null>>([]);

  const prices = pricesForCountry(priceBook, "US");
  const money = (p: number) => formatMoney(p, prices.currency, "en-US");
  const price = prices.standard;
  const tr = (value: string) => phrase(value, locale);

  const courtTotal = useMemo(() => sports.reduce((s, sport) => s + (counts[sport] ?? 1), 0), [sports, counts]);

  const validateStep = (index: number) => {
    const panel = panels.current[index];
    if (!panel) return true;
    const fields = Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"));
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    if (index === 2 && sports.length === 0) return false;
    return true;
  };
  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="country" value="US" />
      <input type="hidden" name="monthlyQuote" value={prices.standard} />
      <input type="hidden" name="billingCurrency" value={prices.currency} />
      <input type="hidden" name="quote" value={price} />
      <input type="hidden" name="mode" value="CUSTOM" />

      <div className="min-w-0 space-y-5">
        <ol className="flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li key={label}>
              <button type="button" onClick={() => { if (i < step || validateStep(step)) setStep(i); }} aria-current={i === step ? "step" : undefined} className={`pill min-h-9 text-xs ${i === step ? "is-active" : i < step ? "border-success/40 text-success-ink" : ""}`}>
                {i < step ? <Icon name="check" size={14} /> : <span className="data">{i + 1}</span>} {label}
              </button>
            </li>
          ))}
        </ol>

        {/* Step 1: the plan — there is exactly one */}
        <div ref={(el) => { panels.current[0] = el; }} hidden={step !== 0} className="card-flat space-y-5">
          <div>
            <h2 className="display text-display-md">One plan. The whole system.</h2>
            <p className="mt-1 text-sm text-slate">Every club gets everything. No setup fee, no contract — you pay from the day you start and can cancel any month.</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border-2 border-court bg-court-tint/40 p-5">
            <div>
              <p className="eyebrow text-court-dark">RacketBuddy for clubs</p>
              <p className="mt-1"><span className="display text-display-lg">{money(prices.standard)}</span><span className="text-slate"> / month</span></p>
              <p className="mt-1 text-sm text-slate">Billed monthly from today · cancel anytime · 0% commission on court bookings</p>
            </div>
            <Icon name="check" size={28} className="text-court" />
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["Court calendar and online booking", "Courts, hours, pricing, guest and member booking."],
              ["Payments and payouts", "Stripe Connect to your club’s own account. Receipts and refunds built in."],
              ...CUSTOM_FEATURES.map((f) => [FEATURE_EN[f.id]?.label ?? tr(f.label), FEATURE_EN[f.id]?.body ?? ""] as const),
              ["Public club page", "Listed in court search, with your photos, hours and news."],
            ].map(([label, body]) => (
              <li key={label} className="flex gap-2 rounded-xl border border-slate/10 p-3">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-success" />
                <span><span className="block font-semibold">{label}</span>{body && <span className="block text-xs text-slate">{body}</span>}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate">Prices exclude any applicable sales tax. The total is shown before you pay. Players and coaches use RacketBuddy for free; coaches pay 10% on lessons booked through the platform — clubs never pay commission.</p>
          <div className="flex justify-end"><button type="button" onClick={next} className="btn-court">Continue <Icon name="arrow" /></button></div>
        </div>

        {/* Step 2: facility */}
        <div ref={(el) => { panels.current[1] = el; }} hidden={step !== 1} className="card-flat space-y-4">
          <div>
            <h2 className="display text-display-md">Your facility</h2>
            <p className="mt-1 text-sm text-slate">Your browser can autofill a saved address. Everything stays editable in the admin afterwards.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="label">Club name</span><input className="input" name="name" autoComplete="organization" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder="Brookline Racquet Club" /></label>
            <label className="sm:col-span-2"><span className="label">Street address</span><input className="input" name="address" autoComplete="street-address" enterKeyHint="next" required maxLength={150} placeholder="123 Main St" /></label>
            <label><span className="label">City</span><input className="input" name="city" autoComplete="address-level2" required maxLength={100} placeholder="Boston" value={city} onChange={(e) => setCity(e.target.value)} /></label>
            <label><span className="label">State</span>
              <Select className="input" name="state" autoComplete="address-level1" required value={usState} onChange={(e) => { setUsState(e.target.value); if (e.target.value) setTimeZone(usStateTimeZone(e.target.value)); }}>
                <option value="" disabled>Select state</option>
                {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </Select>
            </label>
            <label><span className="label">ZIP code</span><input className="input" name="postalCode" autoComplete="postal-code" inputMode="numeric" required maxLength={10} pattern="[0-9]{5}(-[0-9]{4})?" placeholder="02108" /></label>
            <label><span className="label">Time zone</span>
              <Select className="input" name="timeZone" value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
                {usTimeZoneOptions(timeZone).map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
              </Select>
              <span className="hint">Set from your state. Change it if your club sits in a different zone.</span>
            </label>
            <label className="sm:col-span-2"><span className="label">Your name</span><input className="input" name="contact" autoComplete="name" required maxLength={150} placeholder="Who runs the club day to day" /></label>
          </div>
          <div className="flex justify-between"><button type="button" onClick={() => setStep(0)} className="btn-ghost">Back</button><button type="button" onClick={next} className="btn-court">Continue <Icon name="arrow" /></button></div>
        </div>

        {/* Step 3: courts */}
        <div ref={(el) => { panels.current[2] = el; }} hidden={step !== 2} className="card-flat space-y-4">
          <div>
            <h2 className="display text-display-md">Courts and pricing</h2>
            <p className="mt-1 text-sm text-slate">Pick your sports and how many courts you have. Names, surfaces, indoor/outdoor and per-court prices can be adjusted afterwards.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SPORTS.map((s) => {
              const on = sports.includes(s);
              return (
                <div key={s} className={`rounded-xl border p-3 ${on ? "border-court bg-court-tint/40" : "border-slate/15"}`}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" name="sports" value={s} checked={on} onChange={(e) => { setSports(e.target.checked ? [...sports, s] : sports.filter((x) => x !== s)); if (e.target.checked && !counts[s]) setCounts({ ...counts, [s]: 1 }); }} />
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sportColor(s) }} />
                    <span className="font-semibold">{sportLabel(s, "en-US")}</span>
                  </label>
                  {on && (
                    <label className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-slate">{s === "BORDTENNIS" ? "Tables" : "Courts"}</span>
                      <input className="input w-24" name={"count_" + s} type="number" min="1" max="30" required value={counts[s] ?? 1} onChange={(e) => setCounts({ ...counts, [s]: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {sports.length === 0 && <p className="field-error">Choose at least one sport.</p>}
          <label className="block max-w-xs"><span className="label">Guest price per hour (USD)</span><input className="input" name="priceHour" type="number" min="0" max="10000" required value={priceHour} onChange={(e) => setPriceHour(Math.max(0, Number(e.target.value) || 0))} /><span className="hint">What a non-member pays for one court-hour. Member pricing and peak rules come later.</span></label>
          <div className="flex justify-between"><button type="button" onClick={() => setStep(1)} className="btn-ghost">Back</button><button type="button" onClick={next} className="btn-court">Continue <Icon name="arrow" /></button></div>
        </div>

        {/* Step 4: account */}
        <div ref={(el) => { panels.current[3] = el; }} hidden={step !== 3} className="card-flat space-y-4">
          <div>
            <h2 className="display text-display-md">Create your club login</h2>
            <p className="mt-1 text-sm text-slate">The same login works on the website and under Club login in the app. You can add more administrators later.</p>
          </div>
          <label className="block"><span className="label">Email</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
          <label className="block"><span className="label">Password</span><input className="input" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={72} required /><span className="hint">At least 10 characters.</span></label>
          <label className="flex items-start gap-3 text-sm">
            <input className="mt-1" type="checkbox" name="terms" required />
            <span>
              I’m authorized to register this club and accept the <a className="underline" href={termsHref("US")} target="_blank" rel="noreferrer">terms of service</a> and the <a className="underline" href="/dpa" target="_blank" rel="noreferrer">data processing agreement</a>.{" "}
              The {money(prices.standard)}/month subscription starts at payment and renews monthly until you cancel — no setup fee, no minimum term. The club goes public after RacketBuddy’s review.
            </span>
          </label>
          {state?.error && <p role="alert" className="field-error">{phrase(state.error, locale)}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(2)} className="btn-ghost">Back</button>
            <SubmitButton className="btn-court" pendingText="Creating your club…">Create club and continue to payment</SubmitButton>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Preview of your listing">
        <p className="eyebrow mb-2 text-slate">How players will see you</p>
        <div className="overflow-hidden rounded-3xl border border-slate/15 bg-chalk shadow-card">
          <div className="h-24" style={{ background: `linear-gradient(135deg, ${sportColor(sports[0] ?? "TENNIS")} 0%, #0F2138 140%)` }} />
          <div className="p-4">
            <p className="text-lg font-bold leading-tight">{name || "Your club name"}</p>
            <p className="mt-0.5 text-sm text-slate">{city || "City"}{usState ? `, ${usState}` : ""}</p>
            <p className="mt-2 text-sm text-slate">{courtTotal} {courtTotal === 1 ? "court" : "courts"} · {sports.map((s) => sportLabel(s, "en-US")).join(", ") || "Pick a sport"}</p>
            <p className="mt-2 text-sm"><span className="font-bold">from {money(priceHour)}</span><span className="text-slate"> / hour</span></p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="badge-success">Open today</span>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-mist p-4 text-sm">
          <p className="font-bold">Your plan</p>
          <p className="mt-1 text-slate">RacketBuddy for clubs · {money(prices.standard)}/month · cancel anytime</p>
          <p className="mt-2 text-xs text-slate">Everything included. No commission on court bookings. Payouts to your Stripe account.</p>
        </div>
      </aside>
    </form>
  );
}
