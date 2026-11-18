"use server";
// Clearing a conversation from the web list. The same thing the app does:
// it clears it for whoever asked and for nobody else.
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "../../lib/session";
import { loadThread } from "../../lib/messages";
import { clearThread } from "../../lib/thread-clearing";

export async function clearConversation(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Only someone in the conversation may clear their own view of it.
  const access = await loadThread(id, user.id);
  if (!access.ok) return;
  await clearThread(user.id, id);
  revalidatePath("/messages");
}
