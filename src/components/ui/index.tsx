// RacketBuddy UI primitives.
//
// Server-safe building blocks used across the public site, the player
// product and the club admin. Each one is deliberately small: the goal is
// that every screen uses the same spacing, radii, type scale and states
// without re-deciding them. Interactive behaviour lives in the screen that
// needs it, not here.
import Link from "next/link";
import type { ReactNode } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" ");

/* ----------------------------------------------------------------- Button */
type ButtonVariant = "court" | "ink" | "ghost" | "soft" | "danger";
type ButtonSize = "sm" | "md" | "lg";
const variantClass: Record<ButtonVariant, string> = {
  court: "btn-court",
  ink: "btn-ink",
  ghost: "btn-ghost",
  soft: "btn-soft",
  danger: "btn-danger",
};
const sizeClass: Record<ButtonSize, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

type ButtonBase = { variant?: ButtonVariant; size?: ButtonSize; pill?: boolean; className?: string; children: ReactNode };

export function Button({ variant = "court", size = "md", pill, className, children, ...rest }: ButtonBase & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button className={cx(variantClass[variant], sizeClass[size], pill && "btn-pill", className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant = "court", size = "md", pill, className, children, href, ...rest }: ButtonBase & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">) {
  return (
    <Link href={href} className={cx(variantClass[variant], sizeClass[size], pill && "btn-pill", className)} {...rest}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- Card */
export function Card({ className, children, as: Tag = "div", interactive, flat }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li"; interactive?: boolean; flat?: boolean }) {
  return <Tag className={cx(flat ? "card-flat" : "card", interactive && "card-interactive", className)}>{children}</Tag>;
}

/* ------------------------------------------------------------------ Badge */
export function Badge({ tone = "neutral", children, className }: { tone?: "court" | "success" | "warning" | "danger" | "neutral" | "ink"; children: ReactNode; className?: string }) {
  return <span className={cx(`badge-${tone}`, className)}>{children}</span>;
}

/* ------------------------------------------------------------- PageHeader */
export function PageHeader({ eyebrow, title, lead, actions, className }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cx("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow text-slate">{eyebrow}</p>}
        <h1 className={cx("display text-display-md sm:text-display-lg", eyebrow ? "mt-2" : null)}>{title}</h1>
        {lead && <p className="mt-2 max-w-2xl text-slate">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/* --------------------------------------------------------------- StatTile */
export function StatTile({ label, value, hint, tone, className }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "court" | "success" | "warning" | "danger"; className?: string }) {
  const toneText = tone === "court" ? "text-court-dark" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className={cx("card-flat flex flex-col gap-1", className)}>
      <p className="text-sm font-medium text-slate">{label}</p>
      <p className={cx("display text-display-md", toneText)}>{value}</p>
      {hint && <p className="text-xs text-slate-light">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState */
export function EmptyState({ icon, title, body, actions, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx("card-flat flex flex-col items-center px-6 py-10 text-center", className)}>
      {icon && <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-court-tint text-court-dark">{icon}</div>}
      <p className="display text-title">{title}</p>
      {body && <div className="mt-2 max-w-md text-sm leading-relaxed text-slate">{body}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("skeleton", className)} />;
}

/* ------------------------------------------------------------------ Field */
export function Field({ label, htmlFor, hint, error, children, className }: { label: string; htmlFor?: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/* ----------------------------------------------------------------- Notice */
export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tones = {
    info: "border-info/30 bg-info-soft text-info-ink",
    success: "border-success/30 bg-success-soft text-success-ink",
    warning: "border-warning/30 bg-warning-soft text-warning-ink",
    danger: "border-danger/30 bg-danger-soft text-danger-ink",
  } as const;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title && <p className="font-bold">{title}</p>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Icons */
// One stroke weight, one grid, one family — so every screen reads as one set.
const icons = {
  court: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M3 16h18M12 4v16M7 8v8M17 8v8"/></>,
  coach: <><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M6 15l-3-3M18 15l3-3"/></>,
  players: <><circle cx="8" cy="7" r="3"/><circle cx="18" cy="9" r="2"/><path d="M2 21v-3a6 6 0 0 1 12 0v3M16 15a5 5 0 0 1 6 5"/></>,
  members: <><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h3M14 13h3M7 17h3"/></>,
  access: <><path d="M8 10V7a4 4 0 0 1 8 0v3"/><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M12 14v3"/></>,
  website: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M7 6h.01M10 6h.01M8 13h8M8 16h5"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></>,
  check: <path d="m5 12 4.5 4.5L19 7"/>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  dollar: <><circle cx="12" cy="12" r="9"/><path d="M12 6v12M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></>,
  roof: <><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>,
  star: <path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.3l1-6.2L3 9.7l6.2-.9Z"/>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></>,
  warning: <><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5 9 15M15 9l2.5-2.5"/>,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>,
  map: <><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z"/><path d="M9 4v14M15 6v14"/></>,
  x: <path d="M6 6l12 12M18 6 6 18"/>,
} as const;
export type IconName = keyof typeof icons;

export function Icon({ name, size = 20, className, strokeWidth = 1.8 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {icons[name]}
    </svg>
  );
}
