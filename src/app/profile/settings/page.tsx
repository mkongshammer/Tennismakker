import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/session";
import { LEVELS_EN } from "../../../lib/levels";
import { SPORTS, sportLabel } from "../../../lib/sports";
import { Icon } from "../../../components/ui";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile settings", robots: { index: false } };

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile/settings");

  const levels = Object.entries(LEVELS_EN).map(([value, l]) => ({ value: Number(value), label: `NTRP ${l.ntrp} · ${l.label}` }));
  const sports = SPORTS.map((s) => ({ value: s, label: sportLabel(s, "en-US") }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate hover:text-ink">
        <Icon name="chevron" size={16} className="rotate-180" /> Back to profile
      </Link>
      <header>
        <p className="eyebrow text-slate">Profile</p>
        <h1 className="display mt-2 text-3xl sm:text-4xl">Settings</h1>
        <p className="mt-2 text-slate">Update how you appear to players, coaches and clubs.</p>
      </header>
      <SettingsForm
        user={{ name: user.name, email: user.email, phone: user.phone ?? null, area: user.area ?? null, level: user.level, sports: String(user.sports ?? "TENNIS").split(",").filter(Boolean), bio: user.bio ?? null }}
        levels={levels}
        sports={sports}
      />
    </div>
  );
}
