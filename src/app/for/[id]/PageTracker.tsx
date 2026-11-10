"use client";
// Tells us which part of the club page is on screen, how long each part was
// read, how far down they got and what they clicked. Sends a small heartbeat
// every 10 seconds while the tab is visible. No cookies; the visit id lives in
// sessionStorage so the signup that follows joins the same visit.
import { useEffect } from "react";

export const VISIT_KEY = "rb_preview_visit";

export function send(body: Record<string, unknown>) {
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/club-preview/track", new Blob([json], { type: "application/json" }))) return;
  } catch { /* fall through */ }
  fetch("/api/club-preview/track", { method: "POST", headers: { "content-type": "application/json" }, body: json, keepalive: true }).catch(() => {});
}

export function visitFor(id: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? "null") as { id: string; visit: string } | null;
    if (saved?.id === id) return saved.visit;
    const visit = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    sessionStorage.setItem(VISIT_KEY, JSON.stringify({ id, visit }));
    return visit;
  } catch {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }
}

export function PageTracker({ id }: { id: string }) {
  useEffect(() => {
    const visit = visitFor(id);
    const seen: Record<string, number> = {};
    const inView = new Map<string, number>(); // section -> visible ratio
    let active = 0;
    let maxScroll = 0;
    let last = Date.now();

    const sections = [...document.querySelectorAll<HTMLElement>("[data-track]")];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) inView.set((e.target as HTMLElement).dataset.track!, e.isIntersecting ? e.intersectionRatio : 0);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    sections.forEach((s) => io.observe(s));

    const current = () => [...inView.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "hero";
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      if (document.visibilityState !== "visible") return;
      active += dt;
      for (const [s, r] of inView) if (r >= 0.25) seen[s] = (seen[s] ?? 0) + dt;
      const doc = document.documentElement;
      const pct = ((window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight)) * 100;
      maxScroll = Math.max(maxScroll, Math.min(100, pct));
    };
    const beat = () => send({ id, visit, kind: "beat", section: current(), seen, scroll: Math.round(maxScroll), active: Math.round(active) });

    const t1 = setInterval(tick, 1000);
    const t2 = setInterval(() => { if (document.visibilityState === "visible") beat(); }, 10_000);
    const first = setTimeout(beat, 4000);
    const onHide = () => { if (document.visibilityState === "hidden") beat(); };
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-track-click]");
      if (el) send({ id, visit, kind: "click", what: el.dataset.trackClick });
    };
    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("click", onClick);
    return () => { clearInterval(t1); clearInterval(t2); clearTimeout(first); io.disconnect(); document.removeEventListener("visibilitychange", onHide); document.removeEventListener("click", onClick); };
  }, [id]);
  return null;
}
