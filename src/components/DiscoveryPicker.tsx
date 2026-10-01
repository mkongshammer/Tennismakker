'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

type Option = { value: string; label: string; icon: ReactNode; searchTerms?: string };
type Props = {
  name: 'country' | 'sport';
  label: string;
  title: string;
  hint: string;
  value: string;
  options: Option[];
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
};

const normalise = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function DiscoveryPicker({ name, label, title, hint, value, options, open, onOpen, onClose, onChange, searchPlaceholder, emptyText }: Props) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), search = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const selected = options.find(option => option.value === value) ?? options[0];
  const filtered = options.filter(option => normalise(`${option.label} ${option.value} ${option.searchTerms ?? ''}`).includes(normalise(query.trim())));

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    const index = Math.max(0, options.findIndex(option => option.value === value));
    setActive(index);
    if (searchPlaceholder) search.current?.focus();
    else optionRefs.current.get(value)?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  // Opening sets the initial focus; filtering and arrow keys manage it afterwards.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(option: Option) {
    onChange(option.value);
    onClose();
    trigger.current?.focus();
  }
  function focusOption(index: number) {
    if (!filtered.length) return;
    const next = (index + filtered.length) % filtered.length;
    setActive(next);
    optionRefs.current.get(filtered[next].value)?.focus();
  }
  function navigate(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); trigger.current?.focus(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(event.target === search.current ? 0 : active + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(event.target === search.current ? filtered.length - 1 : active - 1); }
    else if (event.target !== search.current && event.key === 'Home') { event.preventDefault(); focusOption(0); }
    else if (event.target !== search.current && event.key === 'End') { event.preventDefault(); focusOption(filtered.length - 1); }
    else if (event.target === search.current && event.key === 'Enter') { event.preventDefault(); if (filtered.length === 1) choose(filtered[0]); else focusOption(0); }
  }

  return <div ref={root} className="discovery-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onClose(); }}>
    <input type="hidden" name={name} value={value}/>
    <button ref={trigger} type="button" className={`discovery-trigger ${open ? 'is-open' : ''}`} aria-label={`${label}: ${selected.label}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined} onClick={() => open ? onClose() : onOpen()} onKeyDown={event => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); onOpen(); } }}>
      <span className="flex min-w-0 items-center gap-3"><span className="discovery-trigger-icon">{selected.icon}</span><span className="min-w-0 text-left"><span className="block text-xs font-bold text-slate">{label}</span><span className="mt-1 block truncate text-base font-semibold text-ink">{selected.label}</span></span></span>
      <svg className={`shrink-0 text-slate transition-transform ${open ? 'rotate-180' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    {open && <div className={`discovery-panel discovery-panel-${name}`} id={`${id}-panel`} role="dialog" aria-labelledby={`${id}-title`} onKeyDown={navigate}>
      <h3 id={`${id}-title`} className="text-xl">{title}</h3>
      <p className="mt-1 text-sm text-slate">{hint}</p>
      {searchPlaceholder && <div className="discovery-filter"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input ref={search} type="search" autoComplete="off" aria-label={searchPlaceholder} placeholder={searchPlaceholder} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} aria-controls={`${id}-options`}/></div>}
      <div id={`${id}-options`} role="listbox" aria-label={label} className="discovery-options">
        {filtered.map((option, index) => <button ref={element => { if (element) optionRefs.current.set(option.value, element); else optionRefs.current.delete(option.value); }} key={option.value} type="button" role="option" aria-selected={option.value === value} tabIndex={index === active ? 0 : -1} onFocus={() => setActive(index)} onClick={() => choose(option)} className={`discovery-option ${option.value === value ? 'is-selected' : ''}`}>
          <span className="discovery-option-icon">{option.icon}</span><span className="min-w-0 flex-1 text-left font-semibold">{option.label}</span>{option.value === value && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>}
        </button>)}
      </div>
      {!filtered.length && <p className="py-6 text-sm text-slate" role="status">{emptyText}</p>}
    </div>}
  </div>;
}
