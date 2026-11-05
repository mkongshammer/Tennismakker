// "Get it on" links to the native apps. Until the iOS app is approved, a
// non-clickable "Coming soon on the App Store" badge stands next to Google Play;
// set APP_STORE_URL to swap it for the real link.
export const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=dk.racketbuddy.app";
export const APP_STORE_URL: string | null = null;

function Badge({ href, top, name, icon }: { href: string; top: string; name: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="keep-light inline-flex h-12 items-center gap-2.5 rounded-xl border border-white/25 bg-black px-4 text-white transition hover:border-white/60"
      aria-label={`${top} ${name}`}
    >
      {icon}
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium uppercase tracking-wide text-white/75">{top}</span>
        <span className="mt-0.5 text-[17px] font-semibold tracking-tight">{name}</span>
      </span>
    </a>
  );
}

export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <Badge
        href={GOOGLE_PLAY_URL}
        top="Get it on"
        name="Google Play"
        icon={<svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M5 3.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 5 3.5Z" /></svg>}
      />
      {!APP_STORE_URL && (
        // Not a link yet: the iOS app is in review with Apple.
        <span
          className="keep-light inline-flex h-12 cursor-default items-center gap-2.5 rounded-xl border border-dashed border-white/35 bg-black/60 px-4 text-white/85"
          aria-label="Coming soon on the App Store"
          title="The iPhone app is in review with Apple. Until then, everything works in your phone's browser."
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><line x1="10.5" y1="18.5" x2="13.5" y2="18.5" /></svg>
          <span className="flex flex-col leading-none">
            <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">Coming soon on the</span>
            <span className="mt-0.5 text-[17px] font-semibold tracking-tight">App Store</span>
          </span>
        </span>
      )}
      {APP_STORE_URL && (
        <Badge
          href={APP_STORE_URL}
          top="Download on the"
          name="App Store"
          icon={<svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><line x1="10.5" y1="18.5" x2="13.5" y2="18.5" /></svg>}
        />
      )}
    </div>
  );
}
