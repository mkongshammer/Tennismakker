"use client";
import { useEffect } from "react";
import { onHuman } from "./human";

/** Counts a view once a person has had the page open for a few seconds and actually used it (scrolled, moved the mouse, tapped). */
export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    const opened = Date.now();
    let t: ReturnType<typeof setTimeout> | undefined;
    const stop = onHuman(() => {
      t = setTimeout(() => {
        fetch("/api/club-preview/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
      }, Math.max(0, 4000 - (Date.now() - opened)));
    });
    return () => { stop(); if (t) clearTimeout(t); };
  }, [id]);
  return null;
}
