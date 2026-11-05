"use client";
// Spanish mode for the website. The pages are written in English; when a
// visitor picks Español, this swaps every piece of interface text that has a
// Spanish entry in /i18n/es.json (built by scripts/build-es-dictionary.mjs),
// and keeps doing so as the page changes. User content (club names, messages)
// only changes if it happens to equal a dictionary phrase, and anything inside
// [data-no-translate] is left alone.
import { useEffect } from "react";

const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

export function SpanishTranslator() {
  useEffect(() => {
    let dict: Record<string, string> = {};
    let patterns: { re: RegExp; names: string[]; to: string }[] = [];
    let observer: MutationObserver | null = null;
    let pending = new Set<Node>();
    let frame = 0;
    const done = new WeakMap<Node, string>(); // node → the text we wrote

    const lookup = (raw: string) => {
      const key = raw.replace(/\s+/g, " ").trim();
      if (!key || key.length > 600) return null;
      let hit = dict[key];
      if (!hit) {
        for (const p of patterns) {
          const m = p.re.exec(key);
          if (!m) continue;
          // Placeholder values (prices, names) can themselves be translated phrases.
          hit = p.to.replace(/\{([a-z])\}/g, (_, n: string) => { const v = m[p.names.indexOf(n) + 1] ?? ""; return dict[v] ?? v; });
          break;
        }
      }
      if (!hit) return null;
      const lead = raw.match(/^\s*/)?.[0] ?? "";
      const trail = raw.match(/\s*$/)?.[0] ?? "";
      return lead + hit + trail;
    };
    const skipped = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        if (SKIP.has(e.tagName) || e.hasAttribute("data-no-translate") || (e as HTMLElement).isContentEditable) return true;
      }
      return false;
    };
    const textNode = (n: Text) => {
      if (done.get(n) === n.data) return;
      if (skipped(n.parentElement)) return;
      const t = lookup(n.data);
      if (t && t !== n.data) { n.data = t; done.set(n, t); }
    };
    const element = (el: Element) => {
      if (el.closest("[data-no-translate]") || (el.parentElement && skipped(el.parentElement) && !(el instanceof HTMLTextAreaElement))) return;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        const t = lookup(v);
        if (t && t !== v) el.setAttribute(a, t);
      }
      if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button") && el.value) {
        const t = lookup(el.value);
        if (t) el.value = t;
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) return textNode(root as Text);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      element(root as Element);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.nodeType === Node.TEXT_NODE) textNode(n as Text);
        else element(n as Element);
      }
    };
    const flush = () => {
      frame = 0;
      const nodes = pending;
      pending = new Set();
      nodes.forEach((n) => { if (n.isConnected) walk(n); });
    };
    const queue = (n: Node) => { pending.add(n); if (!frame) frame = requestAnimationFrame(flush); };
    const reveal = () => document.documentElement.classList.remove("rb-es-pending");

    fetch("/i18n/es.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { exact?: Record<string, string>; patterns?: [string, string][] }) => {
        dict = d.exact ?? {};
        const esc = (x: string) => x.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
        patterns = (d.patterns ?? []).map(([from, to]: [string, string]) => {
          const names: string[] = [];
          const src = from.split(/(\{[a-z]\})/).map((part) => { const n = /^\{([a-z])\}$/.exec(part); if (n) { names.push(n[1]); return "(.+?)"; } return esc(part); }).join("");
          return { re: new RegExp(`^${src}$`), names, to };
        });
        walk(document.body);
        const title = lookup(document.title);
        if (title) document.title = title;
        reveal();
        observer = new MutationObserver((records) => {
          for (const r of records) {
            if (r.type === "characterData") queue(r.target);
            else if (r.type === "attributes") queue(r.target);
            else r.addedNodes.forEach(queue);
          }
        });
        observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
      })
      .catch(reveal);
    return () => { observer?.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return null;
}
