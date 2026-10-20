"use client";
// The site's dropdown: same look as the filter menus (PillMenu) instead of the
// operating system's list, which looked different on every browser and broke
// with the rest of the design.
//
// Drop-in for <select>: takes the same props and <option> children, submits
// through a hidden native <select> (so forms, `required` and FormData work
// unchanged) and calls onChange with an event-like object whose
// target.value is the new value. Keyboard: Enter/Space/arrows open, arrows
// and Home/End move, Enter picks, Escape closes, typing a letter jumps.
// On phones the menu is a bottom sheet, like the filter menus.
import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import { Icon } from "./index";

type Option = { value: string; label: ReactNode; text: string; disabled: boolean };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode; text?: string };
    return props.text ?? textOf(props.children);
  }
  return "";
}

function readOptions(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const p = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
      const text = textOf(p.children);
      out.push({ value: p.value != null ? String(p.value) : text, label: p.children, text, disabled: Boolean(p.disabled) });
    } else if (child.type === "optgroup" || (child.props as { children?: ReactNode }).children) {
      out.push(...readOptions((child.props as { children?: ReactNode }).children));
    }
  });
  return out;
}

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "defaultValue"> & {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } }) => void;
  children?: ReactNode;
};

export function Select({ value, defaultValue, onChange, children, className = "input", id, name, required, disabled, "aria-label": ariaLabel, ...rest }: Props) {
  const options = useMemo(() => readOptions(children), [children]);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(() => String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""));
  const current = controlled ? String(value) : inner;
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = options.at(selectedIndex);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(Math.max(0, selectedIndex));
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<Array<HTMLLIElement | null>>([]);
  const native = useRef<HTMLSelectElement>(null);
  const listId = useId();
  const autoId = useId();
  const buttonId = id ?? autoId;

  // Keep the hidden select in step for forms, validation and reset().
  useEffect(() => { if (native.current) native.current.value = current; }, [current]);
  useEffect(() => {
    const form = native.current?.form;
    if (!form || controlled) return;
    const reset = () => setInner(String(defaultValue ?? options.find((o) => !o.disabled)?.value ?? ""));
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [controlled, defaultValue, options]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    items.current.at(focus)?.scrollIntoView({ block: "nearest" });
    items.current.at(focus)?.focus();
    return () => document.removeEventListener("pointerdown", close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (o: Option) => {
    if (o.disabled) return;
    if (!controlled) setInner(o.value);
    onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } });
    setOpen(false);
    button.current?.focus();
  };
  const step = (from: number, delta: number) => {
    for (let i = 1; i <= options.length; i++) {
      const next = (from + delta * i + options.length * i) % options.length;
      if (!options.at(next)?.disabled) return next;
    }
    return from;
  };
  const moveTo = (i: number) => { setFocus(i); items.current.at(i)?.focus(); };
  const jump = (key: string) => {
    const start = open ? focus : selectedIndex;
    for (let i = 1; i <= options.length; i++) {
      const j = (start + i) % options.length;
      const o = options.at(j);
      if (o && !o.disabled && o.text.trim().toLowerCase().startsWith(key.toLowerCase())) return j;
    }
    return -1;
  };

  return (
    <div ref={root} className="relative">
      <select
        ref={native}
        name={name}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        defaultValue={current}
        onFocus={() => button.current?.focus()}
        {...rest}
      >
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.text}</option>)}
      </select>
      <button
        ref={button}
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => { setFocus(Math.max(0, selectedIndex)); setOpen((v) => !v); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setFocus(Math.max(0, selectedIndex)); setOpen(true); }
          else if (e.key.length === 1 && /\S/.test(e.key)) { const j = jump(e.key); if (j >= 0) pick(options[j]); }
        }}
        className={`${className} relative flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`min-w-0 truncate ${selected && !selected.disabled ? "" : "text-slate-light"}`}>{selected ? selected.label : " "}</span>
        <Icon name="chevron" size={16} className={`shrink-0 text-slate transition-transform ${open ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {open && <div aria-hidden="true" className="fixed inset-0 z-[60] bg-ink/35 backdrop-blur-[1px] sm:hidden" />}
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[70] max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate/15 bg-chalk p-1.5 shadow-pop animate-pop-in sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-[calc(100%+6px)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); moveTo(step(focus, 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); moveTo(step(focus, -1)); }
            else if (e.key === "Home") { e.preventDefault(); moveTo(step(-1, 1)); }
            else if (e.key === "End") { e.preventDefault(); moveTo(step(options.length, -1)); }
            else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const o = options.at(focus); if (o) pick(o); }
            else if (e.key === "Escape" || e.key === "Tab") { if (e.key === "Escape") e.preventDefault(); setOpen(false); button.current?.focus(); }
            else if (e.key.length === 1 && /\S/.test(e.key)) { const j = jump(e.key); if (j >= 0) moveTo(j); }
          }}
        >
          {options.map((o, i) => {
            const isSel = o.value === current;
            return (
              <li
                key={o.value}
                ref={(el) => { items.current[i] = el; }}
                role="option"
                aria-selected={isSel}
                aria-disabled={o.disabled || undefined}
                tabIndex={i === focus ? 0 : -1}
                onClick={() => pick(o)}
                className={`flex min-h-10 cursor-pointer items-center justify-between gap-4 rounded-xl px-3 text-sm outline-none transition-colors ${o.disabled ? "cursor-default text-slate-light" : isSel ? "bg-court-tint font-semibold text-court-dark" : "hover:bg-mist focus-visible:bg-mist"}`}
              >
                <span className="min-w-0">{o.label}</span>
                {isSel && <Icon name="check" size={16} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
