import test from "node:test";
import assert from "node:assert/strict";
import { groupsThenKnockout, parseScore, roundRobin, scheduleMatches, seedPositions, singleElimination, standings, shuffle, roundName } from "./tournament-draw";

const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }));

test("seed positions keep 1 and 2 apart until the final", () => {
  assert.deepEqual(seedPositions(4), [1, 4, 2, 3]);
  assert.deepEqual(seedPositions(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test("single elimination with 6 players gives the top two seeds a bye and a full bracket of 8", () => {
  const m = singleElimination(entries(6));
  const r1 = m.filter((x) => x.round === 1);
  assert.equal(r1.length, 4);
  assert.equal(r1.filter((x) => x.status === "BYE").length, 2);
  const byes = r1.filter((x) => x.status === "BYE").map((x) => x.winnerId).sort();
  assert.deepEqual(byes, ["p1", "p2"]);
  // Bye winners already sit in round 2.
  const r2 = m.filter((x) => x.round === 2);
  assert.equal(r2.length, 2);
  assert.ok(r2.some((x) => x.homeId === "p1" || x.awayId === "p1"));
  const final = m.find((x) => x.round === 3)!;
  assert.equal(final.nextKey, null);
  assert.equal(m.length, 4 + 2 + 1);
  assert.equal(roundName(1, 3), "Quarterfinals");
  assert.equal(roundName(3, 3), "Final");
});

test("round robin: everyone meets everyone exactly once, nobody plays twice in a round", () => {
  for (const n of [4, 5, 7, 8]) {
    const m = roundRobin(entries(n));
    assert.equal(m.length, (n * (n - 1)) / 2);
    const pairs = new Set(m.map((x) => [x.homeId, x.awayId].sort().join("|")));
    assert.equal(pairs.size, m.length);
    const rounds = new Map<number, string[]>();
    for (const x of m) rounds.set(x.round, [...(rounds.get(x.round) ?? []), x.homeId!, x.awayId!]);
    for (const players of rounds.values()) assert.equal(new Set(players).size, players.length);
    assert.equal(rounds.size, n % 2 ? n : n - 1);
  }
});

test("groups then knockout: 10 players become 2 or 3 groups and a knockout of the top two", () => {
  const { groups, matches } = groupsThenKnockout(entries(10), 4);
  const sizes = Object.values(groups).map((g) => g.length);
  assert.equal(sizes.reduce((a, b) => a + b, 0), 10);
  assert.ok(sizes.every((s) => s >= 3 && s <= 4));
  // Snake seeding: seed 1 and seed 2 are in different groups.
  const groupOf = (id: string) => Object.entries(groups).find(([, g]) => g.some((e) => e.id === id))![0];
  assert.notEqual(groupOf("p1"), groupOf("p2"));
  const ko = matches.filter((m) => m.stage === "KO");
  assert.ok(ko.length > 0);
  assert.ok(ko.some((m) => m.homeId === "A1" || m.awayId === "A1"));
  // Nobody meets their own group again in the first knockout round.
  for (const n of [6, 8, 10, 12, 16]) {
    const r1 = groupsThenKnockout(entries(n), 4).matches.filter((m) => m.stage === "KO" && m.round === 1 && m.homeId && m.awayId);
    assert.ok(r1.every((m) => m.homeId![0] !== m.awayId![0]), `${n} players`);
  }
});

test("standings rank by points, then head to head, then sets", () => {
  const t = standings(["a", "b", "c"], [
    { homeId: "a", awayId: "b", winnerId: "a", score: "6-4 6-4" },
    { homeId: "b", awayId: "c", winnerId: "b", score: "6-0 6-0" },
    { homeId: "c", awayId: "a", winnerId: "c", score: "7-6 7-6" },
  ]);
  // All 1-1 in a cycle, all 2-2 in sets → games decide: b +8, a +2, c −10.
  assert.deepEqual(t.map((x) => x.id), ["b", "a", "c"]);
  const two = standings(["a", "b", "c", "d"], [
    { homeId: "a", awayId: "b", winnerId: "a", score: "6-4 6-4" },
    { homeId: "a", awayId: "c", winnerId: "a", score: "6-4 6-4" },
    { homeId: "d", awayId: "a", winnerId: "d", score: "6-4 6-4" },
    { homeId: "b", awayId: "c", winnerId: "b", score: "6-0 6-0" },
    { homeId: "b", awayId: "d", winnerId: "b", score: "6-0 6-0" },
    { homeId: "c", awayId: "d", winnerId: "c", score: "6-4 6-4" },
  ]);
  // a and b both have 2 wins; a beat b, so a is first even though b has the better set difference.
  assert.deepEqual(two.map((x) => x.id), ["a", "b", "c", "d"]);
  assert.deepEqual(parseScore("6-3, 4-6, 10-7"), { setsHome: 2, setsAway: 1, gamesHome: 20, gamesAway: 16 });
  assert.equal(parseScore("walkover"), null);
});

test("schedule fills parallel courts round by round and skips byes", () => {
  const m = singleElimination(entries(6));
  const start = new Date("2026-11-07T09:00:00Z");
  const s = scheduleMatches(m, start, 60, ["Court 1", "Court 2"]);
  const r1 = s.filter((x) => x.round === 1 && x.status !== "BYE");
  assert.equal(r1.length, 2);
  assert.ok(r1.every((x) => x.scheduledAt!.getTime() === start.getTime()));
  assert.deepEqual(r1.map((x) => x.courtName), ["Court 1", "Court 2"]);
  const r2 = s.filter((x) => x.round === 2);
  assert.ok(r2.every((x) => x.scheduledAt!.getTime() === start.getTime() + 3_600_000));
  const final = s.find((x) => x.round === 3)!;
  assert.equal(final.scheduledAt!.getTime(), start.getTime() + 2 * 3_600_000);
  assert.ok(s.filter((x) => x.status === "BYE").every((x) => x.scheduledAt === null));
});

test("a random draw is reproducible from its seed", () => {
  assert.deepEqual(shuffle([1, 2, 3, 4, 5, 6], "draw-1"), shuffle([1, 2, 3, 4, 5, 6], "draw-1"));
  assert.notDeepEqual(shuffle([1, 2, 3, 4, 5, 6, 7, 8], "a"), shuffle([1, 2, 3, 4, 5, 6, 7, 8], "b"));
});
