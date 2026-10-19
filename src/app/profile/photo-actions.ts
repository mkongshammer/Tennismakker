"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { removeUserProfilePhoto, storeUserProfilePhoto } from "../../lib/profile-images";

export async function uploadProfilePhoto(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const file = formData.get("photo");
  if (!(file instanceof File)) return;

  await storeUserProfilePhoto(user.id, file);
  revalidatePath("/profile");
  revalidatePath("/players");
}

export async function deleteProfilePhoto() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await removeUserProfilePhoto(user.id);
  revalidatePath("/profile");
  revalidatePath("/players");
}
