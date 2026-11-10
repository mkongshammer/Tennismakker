"use client";
import { useEffect } from "react";

/** Counts a view once a person has had the page open for a few seconds. */
export function ViewBeacon({ id }: { id: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/club-preview/view", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
  }, [id]);
  return null;
}
