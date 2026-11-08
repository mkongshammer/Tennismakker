// 8 Nov 2026, owner's request: remove the conversation that Google's Play
// review account ("Google Review") opened with the owner's own player
// account during app review on 28 Oct. Only threads between exactly these two
// users are removed (their messages go with them). Runs once.
import { db } from "./db";

const FLAG = "oneoff:remove-google-review-thread:2026-11-08";

export async function removeGoogleReviewThread() {
  if (await db.platformSetting.findUnique({ where: { key: FLAG } })) return { done: true };
  const owner = await db.user.findUnique({ where: { email: "m.kongshammer@icloud.com" }, select: { id: true } });
  const reviewers = await db.user.findMany({ where: { name: "Google Review" }, select: { id: true } });
  let removed = 0;
  if (owner && reviewers.length) {
    const ids = reviewers.map((r) => r.id);
    const res = await db.matchRequest.deleteMany({
      where: {
        source: "DIRECT",
        OR: [
          { requesterId: owner.id, acceptedById: { in: ids } },
          { requesterId: { in: ids }, acceptedById: owner.id },
        ],
      },
    });
    removed = res.count;
  }
  await db.platformSetting.create({ data: { key: FLAG, value: JSON.stringify({ at: new Date().toISOString(), removed }) } });
  return { removed };
}
