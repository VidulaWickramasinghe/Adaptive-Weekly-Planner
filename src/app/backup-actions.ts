"use server";
import { requireUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function restoreBackup(
  _: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const { client, user } = await requireUser();
  const file = form.get("backup");
  if (!(file instanceof File) || !file.size || file.size > 1900000)
    return { error: "Choose a Weekly JSON backup smaller than 1.9 MB." };
  if (form.get("confirm") !== "on")
    return { error: "Confirm that you want to restore missing records." };
  let backup: unknown;
  try {
    backup = JSON.parse(await file.text());
  } catch {
    return { error: "This file is not valid JSON." };
  }
  if (
    !backup ||
    typeof backup !== "object" ||
    !("owner" in backup) ||
    backup.owner !== user.id
  )
    return { error: "Use a backup belonging to this signed-in account." };
  const { data, error } = await client.rpc("restore_backup", { backup });
  if (error)
    return {
      error:
        "Restore rejected. Check the account and file integrity. No partial restore was saved.",
    };
  revalidatePath("/", "layout");
  return {
    success: `Restored ${data} missing records. Existing records and preferences were preserved.`,
  };
}
