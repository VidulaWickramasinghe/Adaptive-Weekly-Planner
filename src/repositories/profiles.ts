import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/domain/settings";
export async function readProfile(
  client: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const { data, error } = await client
    .from("profiles")
    .select("user_id,timezone,week_start_day,preferred_daily_capacity,version")
    .eq("user_id", userId)
    .single();
  if (error)
    throw new Error(
      "Your settings could not be loaded. Check the connection and try again.",
    );
  return data as Profile;
}
