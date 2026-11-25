"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { readProfile } from "@/repositories/profiles";
import { planningWeek } from "@/domain/week";
type State = { error?: string; success?: string };
export async function saveWorkstream(_: State, form: FormData): Promise<State> {
  const { client, user } = await requireUser();
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(200),
      kind: z.enum(["study", "publication"]),
      weekly_target: z.coerce.number().int().min(0).max(10080),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "Enter a title and a weekly target between 0 and 10,080 minutes.",
    };
  const id = String(form.get("id") || "");
  const version = Number(form.get("version") || 0);
  if (
    id &&
    (!z.uuid().safeParse(id).success ||
      !Number.isInteger(version) ||
      version < 0)
  )
    return { error: "Invalid project edit." };
  const query = id
    ? client
        .from("workstreams")
        .update({
          ...parsed.data,
          archived: form.get("operation") === "archive",
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("version", version)
    : client.from("workstreams").insert({ ...parsed.data, user_id: user.id });
  const { data, error } = await query.select("id");
  if (error || !data?.length)
    return {
      error:
        "Could not save or this project changed elsewhere. Your draft is retained; reload the latest record before retrying.",
    };
  revalidatePath("/projects");
  return { success: "Project saved." };
}
export async function saveProjectTask(
  _: State,
  form: FormData,
): Promise<State> {
  const { client, user } = await requireUser();
  const parsed = z
    .object({
      workstream_id: z.uuid(),
      title: z.string().trim().min(1).max(200),
      duration: z.coerce.number().int().min(1).max(1440),
      stage: z.enum([
        "",
        "research",
        "draft",
        "edit",
        "fact-check",
        "proofread",
        "publish",
      ]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Check the task title, stage and minutes." };
  const { data: stream } = await client
    .from("workstreams")
    .select("kind")
    .eq("id", parsed.data.workstream_id)
    .eq("user_id", user.id)
    .eq("archived", false)
    .single();
  if (!stream) return { error: "Project unavailable." };
  const profile = await readProfile(client, user.id);
  const { error } = await client.from("planner_items").insert({
    ...parsed.data,
    stage: stream.kind === "study" ? "" : parsed.data.stage,
    user_id: user.id,
    kind: "task",
    category: stream.kind === "study" ? "Study" : "Publication",
    timezone: profile.timezone,
    planning_week: planningWeek(new Date().toISOString(), profile.timezone)
      .dates[0],
  });
  if (error) return { error: "Could not save the task. Reconnect and retry." };
  revalidatePath("/projects");
  revalidatePath("/planner");
  revalidatePath("/");
  return { success: "Task added to the planning pool." };
}
export async function saveScreenTime(_: State, form: FormData): Promise<State> {
  const { client, user } = await requireUser();
  const parsed = z
    .object({
      local_date: z.iso.date(),
      kind: z.enum(["productive", "recreational"]),
      minutes: z.coerce.number().int().min(0).max(1440),
      version: z.coerce.number().int().min(-1),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Enter a valid date and 0–1440 minutes." };
  const { version, ...values } = parsed.data;
  const result =
    version < 0
      ? await client
          .from("screen_time")
          .insert({ ...values, user_id: user.id })
          .select()
      : await client
          .from("screen_time")
          .update({ minutes: values.minutes })
          .eq("user_id", user.id)
          .eq("local_date", values.local_date)
          .eq("kind", values.kind)
          .eq("version", version)
          .select();
  if (result.error || !result.data?.length)
    return {
      error:
        "Save failed or this entry changed elsewhere. Reload the latest value before retrying.",
    };
  revalidatePath("/progress");
  return { success: "Screen time saved." };
}
