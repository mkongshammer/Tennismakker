import { levelLabel, levelNtrp } from "../lib/levels";

export function LevelBadge({ level, locale = "en-US" }: { level: number; locale?: string }) {
  const ntrp = locale === "en-US" ? levelNtrp(level) : null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-chalk" title={ntrp ? `NTRP ${ntrp}` : undefined}>
      <span className="rounded-sm bg-chalk px-1 font-mono text-ink">{ntrp ?? level}</span>
      {levelLabel(level, locale)}
    </span>
  );
}
