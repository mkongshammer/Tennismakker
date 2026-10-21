import { Icon } from "../ui";

// The landing page's right-hand visual: a hard court seen from above with
// the three moments RacketBuddy is for — pick an open hour, get it
// confirmed, book a coach. Drawn, not photographed, so it is always sharp,
// always on brand and never shows a court or a person that isn't real.
// Sample values only: no club names, ratings or counts that could read as
// claims.
const SLOTS: { time: string; state: "taken" | "open" | "picked" }[] = [
  { time: "5:00 PM", state: "taken" },
  { time: "6:00 PM", state: "picked" },
  { time: "7:00 PM", state: "open" },
  { time: "8:00 PM", state: "open" },
];

function Court() {
  // Doubles court, 78 × 36 ft, drawn at 10 px per foot inside a 10 px apron.
  return (
    <svg viewBox="0 0 460 860" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="hv-surface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B84E8" />
          <stop offset="1" stopColor="#1B62C4" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="460" height="860" rx="34" fill="#14509F" />
      <rect x="50" y="40" width="360" height="780" rx="4" fill="url(#hv-surface)" />
      <g fill="none" stroke="#F4F8FF" strokeWidth="4" strokeLinecap="square">
        <rect x="50" y="40" width="360" height="780" />
        <line x1="95" y1="40" x2="95" y2="820" />
        <line x1="365" y1="40" x2="365" y2="820" />
        <line x1="95" y1="250" x2="365" y2="250" />
        <line x1="95" y1="610" x2="365" y2="610" />
        <line x1="230" y1="250" x2="230" y2="610" />
        <line x1="230" y1="40" x2="230" y2="52" />
        <line x1="230" y1="808" x2="230" y2="820" />
      </g>
      <line x1="30" y1="430" x2="430" y2="430" stroke="#0F2138" strokeOpacity=".35" strokeWidth="14" />
      <line x1="30" y1="430" x2="430" y2="430" stroke="#FFFFFF" strokeWidth="5" />
    </svg>
  );
}

export function HeroVisual() {
  return (
    <figure
      role="img"
      aria-label="RacketBuddy on a phone: choose an open hour on a court, get it confirmed instantly, and book a coach"
      className="relative isolate h-[400px] overflow-hidden rounded-3xl bg-ink-deep sm:h-[440px] lg:h-[520px]"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120%_90%_at_85%_10%,#1B3554_0%,#0F2138_45%,#081527_100%)]" />

      {/* The court, tilted and running off the frame so it reads as a place, not a diagram. */}
      <div aria-hidden="true" className="absolute -bottom-40 right-[-70px] h-[470px] w-[252px] rotate-[32deg] drop-shadow-[0_40px_60px_rgba(0,0,0,.5)] sm:-bottom-48 sm:right-[60px] sm:h-[680px] sm:w-[365px] lg:-bottom-40 lg:right-[-36px] lg:h-[600px] lg:w-[322px]">
        <Court />
        <svg viewBox="0 0 32 32" className="absolute left-[40%] top-[14%] h-7 w-7 drop-shadow-[0_10px_10px_rgba(0,0,0,.45)] sm:h-8 sm:w-8">
          <circle cx="16" cy="16" r="15" fill="#D8FF3E" />
          <path d="M5 6.5c5 4.5 5 14.5 0 19M27 6.5c-5 4.5-5 14.5 0 19" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>

      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-ink-deep/70 via-transparent to-transparent" />

      {/* 1 · Pick an open hour */}
      <div aria-hidden="true" className="absolute left-5 top-6 w-[250px] rounded-2xl bg-chalk p-4 text-ink shadow-[0_24px_50px_-12px_rgba(0,0,0,.55)] sm:left-8 sm:top-9 sm:w-[280px] sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate">Today · open courts</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-court-tint text-court"><Icon name="court" size={16} /></span>
        </div>
        <p className="mt-2 text-base font-bold leading-tight">Indoor court 2</p>
        <p className="text-xs text-slate">Hard court · lights included</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {SLOTS.map((s) => (
            <span
              key={s.time}
              className={
                s.state === "picked"
                  ? "rounded-lg bg-court px-1 py-2 text-center text-[11px] font-bold text-white ring-2 ring-court/30"
                  : s.state === "taken"
                    ? "rounded-lg bg-mist px-1 py-2 text-center text-[11px] font-semibold text-slate-light line-through"
                    : "rounded-lg border border-slate-line px-1 py-2 text-center text-[11px] font-semibold text-ink"
              }
            >
              {s.time.replace(":00", "")}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-line pt-3">
          <p className="text-sm"><span className="text-lg font-bold">$38</span> <span className="text-slate">/ hour</span></p>
          <span className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white">Reserve</span>
        </div>
      </div>

      {/* 2 · Confirmed */}
      <div aria-hidden="true" className="absolute bottom-6 left-5 flex w-[270px] items-center gap-3 rounded-2xl bg-chalk/95 p-3.5 text-ink shadow-[0_24px_50px_-12px_rgba(0,0,0,.55)] backdrop-blur sm:bottom-9 sm:left-8 sm:w-[300px]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><Icon name="check" size={20} strokeWidth={2.4} /></span>
        <div className="min-w-0">
          <p className="text-sm font-bold">Court 2 is yours · 6 PM</p>
          <p className="truncate text-xs text-slate">Access code sent by email</p>
        </div>
      </div>

      {/* 3 · Coach */}
      <div aria-hidden="true" className="absolute right-6 top-[53%] hidden w-[196px] rounded-2xl bg-chalk p-4 text-ink shadow-[0_24px_50px_-12px_rgba(0,0,0,.55)] sm:block">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#edf3e6] text-grass"><Icon name="coach" size={18} /></span>
          <div>
            <p className="text-sm font-bold leading-tight">Private lesson</p>
            <p className="text-xs text-slate">60 min · Tennis</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm font-bold">$95</p>
          <span className="rounded-full border border-slate-line px-3 py-1.5 text-[11px] font-bold">Request</span>
        </div>
      </div>
    </figure>
  );
}
