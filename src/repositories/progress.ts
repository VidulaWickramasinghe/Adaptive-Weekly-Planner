import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProgressItem } from "@/domain/progress";
import type { OccurrenceChange, ScheduleSlot } from "@/domain/items";
export async function readProgress(client: SupabaseClient, userId: string) {
  const results = await Promise.all([
    client.from("planner_items").select("*").eq("user_id", userId),
    client.from("occurrence_changes").select("*").eq("user_id", userId),
    client.from("schedule_slots").select("*").eq("user_id", userId),
  ]);
  if (results.some((r) => r.error))
    throw Error("Unable to load progress. Reconnect and try again.");
  return {
    items: results[0].data as ProgressItem[],
    changes: results[1].data as OccurrenceChange[],
    slots: results[2].data as ScheduleSlot[],
  };
}
