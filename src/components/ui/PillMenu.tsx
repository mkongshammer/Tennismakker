"use client";
// A pill that opens a small option menu — replaces native <select> inside
// filter rows, where the browser's dropdown clashes with the design.
// Keyboard: Enter/Space/ArrowDown open, arrows move, Enter selects, Escape
// closes. Outside clicks close. Options are plain buttons, so touch targets
// are a full row each. On phones the menu is a bottom sheet (fixed), which
// also escapes the horizontally scrolling filter row that would clip it.
// Long lists (the 30-day date menu) scroll inside the menu.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./index";

export type PillOption<T extends string | number> = { value: T; label: string; hint?: string };

export function PillMenu<T extends string | number>({ label, value, options, onChange, icon, srLabel, defaultValue, className = "" }: {
  /** Text shown on the pill for the current value. */
  label: ReactNode;
  value: T;
  options: PillOption<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  /** Accessible name of the control, e.g. "Maximum price per hour". */
  srLabel: string;
  /** The value that means "no filter"; the pill is highlighted when the value differs from it. Defaults to the first option. */
  defaultValue?: T;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); (root.current?.querySelector("button") as HTMLButtonElement | null)?.focus(); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    items.current[focusIndex]?.focus();
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const move = (delta: number) => {
    const next = (focusIndex + delta + options.length) % options.length;
    setFocusIndex(next);
    items.current[next]?.focus();
  };

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setOpen(true); } }}
        className={`pill min-h-9 text-xs ${value !== (defaultValue ?? options[0]?.value) ? "is-active" : ""}`}
      >
        {icon}
        <span>{label}</span>
        <span className="sr-only">, {srLabel}</span>
        <Icon name="chevron" size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div aria-hidden="true" className="fixed inset-0 z-[60] bg-ink/35 backdrop-blur-[1px] sm:hidden" />}
      {open && (
        <ul
          id={menuId}
          role="listbox"
          aria-label={srLabel}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[70] max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate/15 bg-chalk p-1.5 shadow-pop animate-pop-in sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+6px)] sm:min-w-[12rem]"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
            if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
            if (e.key === "Home") { e.preventDefault(); setFocusIndex(0); items.current[0]?.focus(); }
            if (e.key === "End") { e.preventDefault(); setFocusIndex(options.length - 1); items.current[options.length - 1]?.focus(); }
          }}
        >
          {options.map((option, i) => {
            const selected = option.value === value;
            return (
              <li key={String(option.value)} role="none">
                <button
                  ref={(el) => { items.current[i] = el; }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={i === focusIndex ? 0 : -1}
                  onClick={() => { onChange(option.value); setOpen(false); }}
                  className={`flex min-h-10 w-full items-center justify-between gap-4 rounded-xl px-3 text-left text-sm transition-colors ${selected ? "bg-court-tint font-semibold text-court-dark" : "hover:bg-mist focus-visible:bg-mist"}`}
                >
                  <span>
                    {option.label}
                    {option.hint && <span className="ml-2 text-xs text-slate">{option.hint}</span>}
                  </span>
                  {selected && <Icon name="check" size={16} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
