import { levelLabel, levelNtrp } from "../lib/levels";

export function LevelBadge({ level, locale = "en-US", tone = "dark" }: { level: number; locale?: string; tone?: "dark" | "light" }) {
  const ntrp = locale === "en-US" ? levelNtrp(level) : null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone === "light" ? "bg-white/10 text-white ring-1 ring-white/15" : "bg-ink text-chalk"}`} title={ntrp ? `NTRP ${ntrp}` : undefined}>
      <span className={`rounded-md px-1.5 py-px tabular-nums ${tone === "light" ? "bg-optic text-ink" : "bg-chalk text-ink"}`}>{ntrp && tone === "light" ? `NTRP ${ntrp}` : ntrp ?? level}</span>
      {levelLabel(level, locale)}
    </span>
  );
}
