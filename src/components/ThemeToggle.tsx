"use client";
// Night / light theme switch. Night is the default look; the choice is kept in
// a cookie so the server renders the right theme straight away (no flash).
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.classList.contains("light")); }, []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    document.cookie = `rb_theme=${next ? "light" : "night"}; path=/; max-age=31536000; samesite=lax`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#FAF7F0" : "#0F2138");
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={light} aria-label={light ? "Switch to night theme" : "Switch to light theme"} title={light ? "Night theme" : "Light theme"} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate/20 text-ink hover:bg-mist">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {light ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
        )}
      </svg>
    </button>
  );
}
