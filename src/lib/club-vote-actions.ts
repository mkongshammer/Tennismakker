"use server";
import { headers } from "next/headers";
import { getCurrentUser } from "./session";
import { castVote } from "./club-votes";
import { clientIp } from "./club-signup-guard";

export type VoteState = { ok?: string; error?: string } | null;

export async function voteForClub(_prev: VoteState, form: FormData): Promise<VoteState> {
  if (String(form.get("website") ?? "").trim()) return { ok: "Thanks, your vote is in." }; // honeypot
  const user = await getCurrentUser();
  const r = await castVote({
    clubId: String(form.get("clubId") ?? "") || undefined,
    name: String(form.get("name") ?? ""),
    city: String(form.get("city") ?? ""),
    state: String(form.get("state") ?? ""),
    email: String(form.get("email") ?? user?.email ?? ""),
    sport: String(form.get("sport") ?? "TENNIS"),
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    ip: clientIp(await headers()),
  });
  return r.ok ? { ok: r.message } : { error: r.error };
}

/** Vote from a place page. The page only knows the public slug; the vote key is looked up here. */
export async function voteForPlace(_prev: VoteState, form: FormData): Promise<VoteState> {
  if (String(form.get("website") ?? "").trim()) return { ok: "Thanks, your vote is in." }; // honeypot
  const { voteKeyForSlug, forgetVoteCounts } = await import("./places");
  const clubId = await voteKeyForSlug(String(form.get("slug") ?? ""));
  if (!clubId) return { error: "We couldn’t find that club. Try again from the search." };
  const user = await getCurrentUser();
  const r = await castVote({
    clubId,
    email: String(form.get("email") ?? user?.email ?? ""),
    sport: String(form.get("sport") ?? "TENNIS"),
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    ip: clientIp(await headers()),
  });
  forgetVoteCounts();
  return r.ok ? { ok: r.message } : { error: r.error };
}
