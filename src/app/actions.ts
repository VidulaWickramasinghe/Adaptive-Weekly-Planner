"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, serverClient } from "@/lib/supabase/server";
import { settingsSchema } from "@/domain/settings";
export type FormState = { error?: string; success?: string; version?: number };
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const input = z
    .object({ email: z.email(), password: z.string().min(1).max(1024) })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Enter your email address and password." };
  const client = await serverClient();
  try {
    const { error } = await client.auth.signInWithPassword(input.data);
    if (error)
      return {
        error:
          "Unable to sign in. Check your details and connection, then try again.",
      };
  } catch {
    return { error: "Sign-in is unavailable. Please try again." };
  }
  redirect("/");
}
export async function signOut(): Promise<FormState> {
  const client = await serverClient();
  const { error } = await client.auth.signOut();
  if (error) return { error: "Sign-out failed. Please try again." };
  redirect("/sign-in");
}
export async function saveSettings(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const { client, user } = await requireUser();
  const input = settingsSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Enter a valid time zone and a daily capacity from 0 to 1440 minutes.",
    };
  const { version, ...values } = input.data;
  try {
    const { data, error } = await client
      .from("profiles")
      .update(values)
      .eq("user_id", user.id)
      .eq("version", version)
      .select("version")
      .maybeSingle();
    if (error)
      return {
        error:
          "Settings could not be saved. Your draft is retained. Please try again.",
      };
    if (!data)
      return {
        error:
          "Settings changed on another device. Reload to review the latest values before saving.",
      };
    revalidatePath("/", "layout");
    return { success: "Settings saved.", version: data.version };
  } catch {
    return {
      error: "Connection failed. Your draft is retained. Please try again.",
    };
  }
}
