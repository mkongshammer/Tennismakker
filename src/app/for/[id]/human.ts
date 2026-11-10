"use client";
// Mail security filters (Microsoft Safe Links, Mimecast, Proofpoint…) open
// links in a real browser for a few seconds to check them, so "the page was
// open" isn't proof a person looked. We only count a visit once there has
// been real input: the mouse wheel, mouse movement, a tap or a key.
let human = false;
const waiters: (() => void)[] = [];

export function onHuman(fn: () => void) {
  if (human) { fn(); return () => {}; }
  waiters.push(fn);
  const mark = () => {
    if (human) return;
    human = true;
    for (const ev of EVENTS) window.removeEventListener(ev, mark, true);
    waiters.splice(0).forEach((w) => w());
  };
  const EVENTS = ["wheel", "touchstart", "pointermove", "keydown"] as const; // not "scroll": scanners scroll from script
  for (const ev of EVENTS) window.addEventListener(ev, mark, { capture: true, passive: true });
  return () => { const i = waiters.indexOf(fn); if (i >= 0) waiters.splice(i, 1); };
}
