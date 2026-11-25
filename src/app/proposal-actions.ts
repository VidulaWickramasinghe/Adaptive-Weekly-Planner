"use server";
import { Temporal } from "@js-temporal/polyfill";
import { requireUser } from "@/lib/supabase/server";
import { readPlanning } from "@/repositories/planning";
import { proposeRevision } from "@/domain/revisions";
import { revalidatePath } from "next/cache";
import { planningWeek } from "@/domain/week";
import { redirect } from "next/navigation";
import { z } from "zod";
export async function saveProposal(form: FormData) {
  const { client } = await requireUser();
  const input = z
    .object({
      date: z.iso.date(),
      start: z.coerce.number().int().min(0).max(22),
      end: z.coerce.number().int().min(1).max(23),
    })
    .parse(Object.fromEntries(form));
  if (input.end <= input.start) throw Error("Invalid planning window.");
  const { snapshot, fingerprint } = await readPlanning(client);
  const { profile, items, changes, slots } = snapshot;
  const now = new Date().toISOString();
  const target = Temporal.PlainDate.from(input.date)
    .toZonedDateTime(profile.timezone)
    .toInstant()
    .toString();
  const result = proposeRevision({
    slots,
    now,
    week: target,
    zone: profile.timezone,
    capacity: profile.preferred_daily_capacity,
    startHour: input.start,
    endHour: input.end,
    items,
    changes,
  });
  const { data: id, error: saveError } = await client.rpc("save_revision", {
    fingerprint,
    start_hour: input.start,
    end_hour: input.end,
    week_start: planningWeek(target, profile.timezone).start,
    zone: profile.timezone,
    entries: [...result.proposed, ...result.unscheduled],
  });
  if (saveError)
    redirect(
      "/proposal?notice=" +
        encodeURIComponent(
          "Planning inputs changed or the proposal could not be saved. Generate it again.",
        ),
    );
  redirect("/proposal?saved=" + id);
}

export async function decideProposal(
  _: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const { client } = await requireUser();
  const parsed = z
    .object({ id: z.uuid(), operation: z.enum(["accept", "reject", "undo"]) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid proposal action." };
  const { data, error } = await client.rpc("decide_revision", {
    target: parsed.data.id,
    operation: parsed.data.operation,
  });
  if (error)
    return {
      error: error.message.includes("Planning inputs changed")
        ? error.message
        : "This change could not be applied safely. Check current conflicts and constraints, then generate a fresh proposal.",
    };
  revalidatePath("/planner");
  revalidatePath("/proposal");
  return { success: "Proposal " + data + "." };
}
