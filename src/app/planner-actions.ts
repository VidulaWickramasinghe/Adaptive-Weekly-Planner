"use server";
import { Temporal } from "@js-temporal/polyfill";
import { localInstant } from "@/domain/items";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
export async function saveItem(
  _: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const { client, user } = await requireUser();
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(200),
      kind: z.enum(["commitment", "task", "routine", "protected"]),
      id: z.union([z.literal(""), z.uuid()]),
      version: z.coerce.number().int().nonnegative(),
      category: z.string().trim().max(100),
      minimum_session: z.coerce.number().int().min(1).max(1440),
      preferred_start: z.coerce.number().int().min(0).max(22),
      preferred_end: z.coerce.number().int().min(1).max(23),
      status: z.enum(["confirmed", "tentative", "cancelled"]),
      duration: z.coerce.number().int().min(1).max(1440),
      priority: z.enum(["low", "medium", "high"]),
      buffer_before: z.coerce.number().int().min(0).max(1440),
      buffer_after: z.coerce.number().int().min(0).max(1440),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the title and activity type." };
  const profile = await readProfile(client, user.id);
  const { data: existing } = parsed.data.id
    ? await client
        .from("planner_items")
        .select("timezone")
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
        .single()
    : { data: null };
  if (parsed.data.id && !existing) return { error: "Activity unavailable." };
  const zone = existing?.timezone ?? profile.timezone;
  let start_at: string | null = null,
    end_at: string | null = null;
  try {
    const start = String(form.get("start") || ""),
      end = String(form.get("end") || "");
    if (start || end) {
      start_at = Temporal.PlainDateTime.from(start)
        .toZonedDateTime(zone, { disambiguation: "reject" })
        .toInstant()
        .toString();
      end_at = Temporal.PlainDateTime.from(end)
        .toZonedDateTime(zone, { disambiguation: "reject" })
        .toInstant()
        .toString();
      if (Date.parse(end_at) <= Date.parse(start_at)) throw Error();
    }
  } catch {
    return {
      error:
        "Enter valid start and end times. End must follow start. Ambiguous daylight-saving times need adjustment.",
    };
  }
  const weekly = form.get("weekly") === "on";
  if (
    (["commitment", "protected"].includes(parsed.data.kind) || weekly) &&
    !start_at
  )
    return { error: "This activity needs a start and end time." };
  const { id, version, ...values } = parsed.data;
  let due_at: string | null = null;
  try {
    if (form.get("due")) due_at = localInstant(String(form.get("due")), zone);
  } catch {
    return { error: "Enter a valid deadline." };
  }
  if (due_at && end_at && Date.parse(end_at) > Date.parse(due_at))
    return { error: "The session must finish by its deadline." };
  const daily = form.get("daily") === "on";
  if (daily && weekly) return { error: "Choose daily or weekly recurrence." };
  if (daily && parsed.data.kind !== "routine")
    return { error: "Daily recurrence is for routines." };
  if (parsed.data.preferred_end <= parsed.data.preferred_start)
    return { error: "End hour must follow start hour." };
  let earliest_at: string | null = null;
  try {
    if (form.get("earliest"))
      earliest_at = localInstant(String(form.get("earliest")), zone);
  } catch {
    return { error: "Invalid earliest start." };
  }
  const payload = {
    earliest_at,
    can_split: form.get("can_split") === "on",
    daily,
    due_at,
    ...values,
    start_at,
    end_at,
    weekly,
    timezone: zone,
  };
  const query = id
    ? client
        .from("planner_items")
        .update({ ...payload, version: version + 1 })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("version", version)
    : client.from("planner_items").insert({ ...payload, user_id: user.id });
  const { data, error } = await query.select("id");
  if (error)
    return {
      error:
        "Save failed. Unlock the activity first. If it has session history, edit its individual occurrences.",
    };
  if (!data?.length)
    return { error: "This activity changed elsewhere. Reload before editing." };
  revalidatePath("/planner");
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/progress");
  return { success: "Activity saved." };
}
export async function changeItem(form: FormData) {
  const { client, user } = await requireUser();
  const input = z
    .object({
      id: z.uuid(),
      operation: z.enum([
        "archive",
        "complete",
        "reopen",
        "lock",
        "unlock",
        "duplicate",
      ]),
    })
    .parse(Object.fromEntries(form));
  const { data: item, error: loadError } = await client
    .from("planner_items")
    .select("*")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .single();
  if (loadError) throw Error("Activity unavailable.");
  if (input.operation === "duplicate") {
    const { id, version, ...copy } = item;
    void id;
    void version;
    const { error } = await client.from("planner_items").insert({
      ...copy,
      title: item.title + " (copy)",
      locked: false,
      completed: false,
      completed_at: null,
      template_id: null,
      session_number: null,
    });
    if (error) throw Error("Copy failed.");
  } else {
    if (item.locked && input.operation !== "unlock")
      throw Error("Unlock the activity first.");
    if (
      ["complete", "reopen"].includes(input.operation) &&
      item.start_at &&
      !item.weekly &&
      !item.daily
    ) {
      const { error } = await client.rpc("edit_occurrence", {
        target_id: item.id,
        target_date: Temporal.Instant.from(item.start_at)
          .toZonedDateTimeISO(item.timezone)
          .toPlainDate()
          .toString(),
        operation: input.operation,
      });
      if (error) throw Error("Could not update completion.");
      revalidatePath("/planner");
      revalidatePath("/");
      revalidatePath("/projects");
      revalidatePath("/progress");
      return;
    }
    const updates =
      input.operation === "archive"
        ? { archived: true }
        : input.operation === "lock"
          ? { locked: true }
          : input.operation === "unlock"
            ? { locked: false }
            : { completed: input.operation === "complete" };
    const { error } = await client
      .from("planner_items")
      .update(updates)
      .eq("id", input.id)
      .eq("version", item.version)
      .select("id")
      .single();
    if (error) throw Error("The activity changed or could not be updated.");
  }
  revalidatePath("/planner");
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/progress");
}
export async function changeOccurrence(
  _: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const { client, user } = await requireUser();
  const parsed = z
    .object({
      id: z.uuid(),
      date: z.iso.date(),
      operation: z.enum(["complete", "reopen", "cancel", "restore", "move"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid occurrence." };
  const { id, date, operation } = parsed.data;
  const { data: item } = await client
    .from("planner_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!item || item.locked)
    return { error: "Unlock the activity before changing its occurrences." };
  const values: Record<string, unknown> = {
    user_id: user.id,
    item_id: id,
    occurrence_date: date,
  };
  if (operation === "move") {
    try {
      values.start_at = localInstant(String(form.get("start")), item.timezone);
      values.end_at = localInstant(String(form.get("end")), item.timezone);
      if (
        Date.parse(String(values.end_at)) <= Date.parse(String(values.start_at))
      )
        throw Error();
      if (
        item.due_at &&
        Date.parse(String(values.end_at)) > Date.parse(item.due_at)
      )
        throw Error();
    } catch {
      return { error: "Enter a valid time range before the deadline." };
    }
  } else if (operation === "cancel" || operation === "restore")
    values.cancelled = operation === "cancel";
  else values.completed = operation === "complete";
  if (form.get("allocation_key")) {
    const allocation = z
      .object({
        allocation_key: z.union([z.literal("single"), z.iso.date()]),
        ordinal: z.coerce.number().int().positive(),
        expected_start: z.string().datetime({ offset: true }),
        expected_end: z.string().datetime({ offset: true }),
      })
      .safeParse(Object.fromEntries(form));
    if (!allocation.success) return { error: "Invalid scheduled chunk." };
    const { error } = await client.rpc("edit_schedule_slot", {
      target_id: id,
      target_key: allocation.data.allocation_key,
      chunk: allocation.data.ordinal,
      operation,
      new_start: values.start_at ?? null,
      new_end: values.end_at ?? null,
      expected_start: allocation.data.expected_start,
      expected_end: allocation.data.expected_end,
    });
    if (error)
      return {
        error:
          "This chunk changed or the edit violates its duration, locks, deadline or conflicts. Reload and check the times.",
      };
    revalidatePath("/planner");
    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath("/progress");
    revalidatePath("/proposal");
    return { success: "Scheduled session updated." };
  }
  const { error } = await client.rpc("edit_occurrence", {
    target_id: id,
    target_date: date,
    operation,
    new_start: values.start_at ?? null,
    new_end: values.end_at ?? null,
  });
  if (error) return { error: "Could not update this occurrence." };
  revalidatePath("/planner");
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/progress");
  return { success: "Occurrence updated." };
}
export async function saveTemplate(
  _: { error?: string; success?: string },
  form: FormData,
): Promise<{ error?: string; success?: string }> {
  const { client, user } = await requireUser();
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(200),
      duration: z.coerce.number().int().min(1).max(1440),
      frequency: z.coerce.number().int().min(1).max(21),
      priority: z.enum(["low", "medium", "high"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Check the template fields." };
  const id = String(form.get("id") || "");
  if (id && !z.uuid().safeParse(id).success)
    return { error: "Invalid template." };
  const query = id
    ? client
        .from("task_templates")
        .update(parsed.data)
        .eq("id", id)
        .eq("user_id", user.id)
    : client
        .from("task_templates")
        .insert({ ...parsed.data, user_id: user.id });
  const { error } = await query.select("id").single();
  if (error) return { error: "Template save failed." };
  revalidatePath("/planner");
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/progress");
  return { success: "Template saved." };
}
export async function templateOperation(form: FormData) {
  const { client, user } = await requireUser();
  if (form.get("operation") === "generate") {
    const date = z.iso.date().parse(form.get("week"));
    if (Temporal.PlainDate.from(date).dayOfWeek !== 7)
      throw Error("Select a Sunday.");
    const { error } = await client.rpc("generate_template_week", {
      target_week: date,
    });
    if (error) throw Error("Could not generate sessions.");
  } else {
    const id = z.uuid().parse(form.get("id"));
    const { error } = await client
      .from("task_templates")
      .update({ archived: true })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw Error("Could not archive template.");
  }
  revalidatePath("/planner");
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/progress");
}
