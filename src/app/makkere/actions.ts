"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../lib/db";
import { getCurrentUser } from "../../lib/session";
import { matchAcceptedNotice, sendMail } from "../../lib/email";

const responseSource = (postId: string) => `POST_RESPONSE:${postId}`;

export async function respondToMatchPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/makkere");

  const post = await db.matchRequest.findUnique({
    where: { id },
    include: { requester: true },
  });

  if (!post || post.status !== "OPEN" || post.requesterId === user.id) {
    redirect("/makkere");
  }

  const source = responseSource(post.id);
  const existing = await db.matchRequest.findFirst({
    where: {
      source,
      requesterId: post.requesterId,
      acceptedById: user.id,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) redirect(`/beskeder/${existing.id}#top`);

  const thread = await db.matchRequest.create({
    data: {
      status: "MATCHED",
      message: post.message,
      area: post.area,
      level: post.level,
      sport: post.sport,
      matchType: post.matchType,
      source,
      requesterId: post.requesterId,
      acceptedById: user.id,
    },
  });

  await sendMail(
    matchAcceptedNotice({
      to: post.requester.email,
      requesterName: post.requester.name,
      accepterName: user.name,
      message: post.message,
      threadId: thread.id,
    })
  );

  revalidatePath("/makkere");
  revalidatePath("/beskeder");
  redirect(`/beskeder/${thread.id}#top`);
}
