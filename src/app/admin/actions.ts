"use server";

import { redirect } from "next/navigation";
import { getCurrentPlayer, unlockAdminMode, lockAdminMode } from "@/lib/session";

const ADMIN_PIN = "2295";

export async function unlockAdmin(formData: FormData) {
  const admin = await getCurrentPlayer();
  if (!admin?.isCommissioner) redirect("/picks");

  const pin = formData.get("pin");
  if (typeof pin !== "string" || pin !== ADMIN_PIN) {
    redirect("/admin?error=1");
  }

  await unlockAdminMode();
  redirect("/admin");
}

export async function exitAdminMode() {
  await lockAdminMode();
  redirect("/picks");
}
