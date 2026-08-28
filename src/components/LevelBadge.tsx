import { levelLabel } from "@/lib/levels";

export function LevelBadge({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-bane px-2.5 py-0.5 text-xs font-bold text-kridt">
      <span className="rounded-sm bg-kridt px-1 font-mono text-bane">{level}</span>
      {levelLabel(level)}
    </span>
  );
}
