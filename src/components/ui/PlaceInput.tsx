"use client";
// "City or area" with suggestions from real US places.
//
// Typing shows up to eight matching cities ("Bos" → Boston, MA). Picking one
// fills the field; the server still checks whatever is submitted and stores
// it as "City, ST", so a typed "boston ma" or a ZIP code works too, and
// "my house" is refused with a clear message. Keyboard: arrows move, Enter
// picks, Escape closes (ARIA combobox pattern).
import { useEffect, useId, useRef, useState } from "react";

export function PlaceInput({ name = "area", id, defaultValue = "", required = false, placeholder = "e.g. Boston, MA", className = "input" }: {
  name?: string;
  id?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const picked = useRef(false);

  useEffect(() => {
    if (picked.current) { picked.current = false; return; }
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

  const pick = (label: string) => { picked.current = true; setValue(label); setOpen(false); setOptions([]); };
  const showList = open && options.length > 0 && !(options.length === 1 && options[0] === value);

  return (
    <div ref={root} className="relative">
      <input
        id={id}
        name={name}
        className={className}
        value={value}
        required={required}
        minLength={2}
        maxLength={100}
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => options.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(options[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {showList && (
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
      )}
    </div>
  );
}
