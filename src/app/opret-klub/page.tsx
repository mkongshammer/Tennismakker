"use client";

import { useFormState } from "react-dom";
import { createClub } from "../../lib/actions";

export default function OpretKlubPage() {
  const [state, action] = useFormState(createClub, null);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="display text-3xl">Få jeres klub på Tennis Makker</h1>
      <p className="mt-2 text-net/70">
        I beholder jeres eget bookingsystem. Vi viser kun de tider, I selv
        frigiver, til spillere udefra — og sender betalingen videre til jer.
      </p>

      <form action={action} className="card mt-6 space-y-5">
        <div>
          <h2 className="mb-3 font-bold">Om klubben</h2>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="clubName">Klubbens navn</label>
              <input className="input" id="clubName" name="clubName" required />
            </div>
            <div>
              <label className="label" htmlFor="address">Adresse</label>
              <input
                className="input"
                id="address"
                name="address"
                placeholder="fx Tennisvej 12"
              />
              <p className="mt-1 text-xs text-net/50">
                Bruges til at vise klubben på kortet og hjælpe gæster med at finde vej.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="city">By</label>
                <input className="input" id="city" name="city" required />
              </div>
              <div>
                <label className="label" htmlFor="courtCount">Antal baner</label>
                <input
                  className="input"
                  id="courtCount"
                  name="courtCount"
                  type="number"
                  min={1}
                  max={40}
                  defaultValue={4}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="priceHour">Gæstepris pr. time</label>
                <input
                  className="input"
                  id="priceHour"
                  name="priceHour"
                  type="number"
                  min={0}
                  defaultValue={100}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="externalSystem">Jeres bookingsystem</label>
                <input
                  className="input"
                  id="externalSystem"
                  name="externalSystem"
                  placeholder="fx Halbooking"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-net/10 pt-5">
          <h2 className="mb-3 font-bold">Hvad vil I betale?</h2>
          <div className="space-y-2">
            <label className="flex cursor-pointer gap-3 rounded-md border border-net/15 p-3">
              <input type="radio" name="billingModel" value="COMMISSION" defaultChecked className="mt-1" />
              <span>
                <span className="block font-semibold">10% af hver gæstebooking</span>
                <span className="block text-sm text-net/60">
                  Ingen fast betaling. Kommer der ingen bookinger, koster det jer
                  ingenting.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-md border border-net/15 p-3">
              <input type="radio" name="billingModel" value="SUBSCRIPTION" className="mt-1" />
              <span>
                <span className="block font-semibold">199 kr om måneden</span>
                <span className="block text-sm text-net/60">
                  Fast pris, og I beholder hele beløbet for hver booking. Bedst
                  når I har mange ledige tider at fylde.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="border-t border-net/10 pt-5">
          <h2 className="mb-3 font-bold">Din konto</h2>
          <p className="mb-3 text-sm text-net/60">
            Du bliver administrator og kan tilføje flere fra klubben bagefter.
          </p>
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Dit navn</label>
              <input className="input" id="name" name="name" required />
            </div>
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input className="input" id="email" name="email" type="email" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Adgangskode (mindst 8 tegn)</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
          </div>
        </div>

        {state?.error && <p className="text-sm font-semibold text-grus">{state.error}</p>}

        <button className="btn-grus w-full">Opret klub</button>
        <p className="text-center text-xs text-net/50">
          Ved oprettelse accepterer du vores{" "}
          <a href="/vilkaar" className="underline">handelsbetingelser</a> og{" "}
          <a href="/databehandleraftale" className="underline">databehandleraftale</a>.
        </p>
      </form>
    </div>
  );
}
