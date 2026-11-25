import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanningSnapshot } from "@/domain/revisions";
export async function readPlanning(
  client: SupabaseClient,
): Promise<{ snapshot: PlanningSnapshot; fingerprint: string }> {
  const { data, error } = await client.rpc("read_planning");
  if (error || !data?.snapshot?.profile)
    throw Error("Unable to load planning inputs.");
  return data;
}
