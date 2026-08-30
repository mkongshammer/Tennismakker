import { levelLabel } from "../lib/levels";

export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-chalk">
      <span className="rounded-sm bg-chalk px-1 font-mono text-ink">{level}</span>
      {levelLabel(level)}
    </span>
  );
}
