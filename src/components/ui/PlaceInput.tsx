"use client";
// "City or area" with suggestions from real US places.
//
// Typing shows up to eight matching cities ("Bos" → Boston, MA). Picking one
// fills the field; the server still checks whatever is submitted and stores
// it as "City, ST", so a typed "boston ma" or a ZIP code works too, and
// "my house" is refused with a clear message. Keyboard: arrows move, Enter
// picks, Escape closes (ARIA combobox pattern).
//
// usePlaceSuggest is the same behaviour for fields that draw their own input
// (the search pill on the court and coach pages), so every place field in the
// product completes what you type, in one implementation.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/** Pure: "Austin, TX" split into its parts. */
export function splitPlace(label: string) {
  const m = /^(.*),\s*([A-Z]{2})$/.exec(label.trim());
  return m ? { city: m[1], state: m[2] } : { city: label.trim(), state: "" };
}

export function usePlaceSuggest(value: string, setValue: (next: string) => void, onPick?: (place: { label: string; city: string; state: string }) => void) {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const picked = useRef(false);
  // Suggestions follow typing only: a saved city shown on page load must not
  // pop a list open over the rest of the form.
  const typed = useRef(false);

  useEffect(() => {
    if (picked.current) { picked.current = false; return; }
    if (!typed.current) return;
    const q = value.trim();
    if (q.length < 2) { setOptions([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/v1/places?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d) => { setOptions(d.places ?? []); setActive(-1); setOpen(true); })
        .catch(() => {});
    }, 150);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value]);

  useEffect(() => {
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const pick = (label: string) => {
    picked.current = true; typed.current = false;
    const parts = splitPlace(label);
    if (onPick) onPick({ label, ...parts }); else setValue(label);
    setOpen(false); setOptions([]);
  };
  const show = open && options.length > 0 && !(options.length === 1 && options[0] === value);

  /** Spread onto the input: the combobox wiring and the keys. */
  const inputProps = {
    autoComplete: "off" as const,
    role: "combobox",
    "aria-autocomplete": "list" as const,
    "aria-expanded": show,
    "aria-controls": listId,
    "aria-activedescendant": show && active >= 0 ? `${listId}-${active}` : undefined,
    onChange: (e: { target: { value: string } }) => { typed.current = true; setValue(e.target.value); },
    onFocus: () => { if (options.length) setOpen(true); },
    onKeyDown: (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(options[active]); }
      else if (e.key === "Escape") setOpen(false);
    },
  };

  const dropdown: ReactNode = show ? (
    <ul id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-slate/15 bg-chalk p-1.5 shadow-pop">
      {options.map((o, i) => (
        <li
          key={o}
          id={`${listId}-${i}`}
          role="option"
          aria-selected={i === active}
          onPointerDown={(e) => { e.preventDefault(); pick(o); }}
          className={`cursor-pointer rounded-xl px-3 py-2.5 text-sm ${i === active ? "bg-mist font-semibold" : "hover:bg-mist"}`}
        >
          {o}
        </li>
      ))}
    </ul>
  ) : null;

  return { root, inputProps, dropdown, pick, show };
}

export function PlaceInput({ name = "area", id, defaultValue = "", value: controlled, onValueChange, onPick, required = false, placeholder = "e.g. Boston, MA", className = "input", ...rest }: {
  name?: string;
  id?: string;
  defaultValue?: string;
  /** Set both to drive the field from the parent (a search box that owns its query). */
  value?: string;
  onValueChange?: (next: string) => void;
  /** Called instead of filling the field — for a form that keeps city and state apart. */
  onPick?: (place: { label: string; city: string; state: string }) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  inputMode?: "text" | "search";
  enterKeyHint?: "search" | "enter" | "done";
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const setValue = (next: string) => { if (onValueChange) onValueChange(next); else setOwn(next); };
  const { root, inputProps, dropdown } = usePlaceSuggest(value, setValue, onPick);

  return (
    <div ref={root} className="relative">
      <input
        {...rest}
        {...inputProps}
        id={id}
        name={name}
        className={className}
        value={value}
        required={required}
        minLength={2}
        maxLength={100}
        placeholder={placeholder}
      />
      {dropdown}
    </div>
  );
}
