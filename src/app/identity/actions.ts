"use server";

import { redirect } from "next/navigation";
import { setCurrentPlayerSlug, clearCurrentPlayerSlug } from "@/lib/session";

export async function chooseIdentity(slug: string, redirectTo: string = "/picks") {
  await setCurrentPlayerSlug(slug);
  redirect(redirectTo);
}

export async function signOutIdentity() {
  await clearCurrentPlayerSlug();
  redirect("/identity");
}
