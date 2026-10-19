import { db } from "./db";

/** Demand by place for the owner's sales view. */
export async function marketInterestSummary(limit = 25) {
  const rows = await db.marketInterest.groupBy({ by: ["placeKey", "label", "kind"], _count: { _all: true }, orderBy: { _count: { placeKey: "desc" } }, take: limit });
  return rows.map((r) => ({ placeKey: r.placeKey, label: r.label, kind: r.kind, count: r._count._all }));
}
