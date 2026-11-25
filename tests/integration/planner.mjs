import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
if (
  !["127.0.0.1", "localhost", "[::1]"].includes(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  )
)
  throw Error(
    "Tests are restricted to local Supabase; production is forbidden.",
  );
const make = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
const a = make(),
  b = make(),
  anon = make();
async function login(client, letter) {
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env["TEST_USER_" + letter + "_EMAIL"],
    password: process.env["TEST_USER_" + letter + "_PASSWORD"],
  });
  assert.equal(error, null);
  return data.user.id;
}
const aId = await login(a, "A"),
  bId = await login(b, "B");
const { data: template, error: templateError } = await a
  .from("task_templates")
  .insert({
    user_id: aId,
    title: "Integration template",
    duration: 45,
    frequency: 3,
    priority: "high",
  })
  .select()
  .single();
assert.equal(templateError, null);
for (let i = 0; i < 2; i++)
  assert.equal(
    (await a.rpc("generate_template_week", { target_week: "2026-11-22" }))
      .error,
    null,
  );
const { data: sessions, error: sessionError } = await a
  .from("planner_items")
  .select("*")
  .eq("template_id", template.id);
assert.equal(sessionError, null);
assert.equal(sessions.length, 3);
const { data: event, error: eventError } = await a
  .from("planner_items")
  .insert({
    user_id: aId,
    title: "Integration lecture",
    kind: "commitment",
    timezone: "Australia/Melbourne",
    start_at: "2026-11-22T22:00:00Z",
    end_at: "2026-11-22T23:00:00Z",
    weekly: true,
  })
  .select()
  .single();
assert.equal(eventError, null);
const mutation = { target_id: event.id, target_date: "2026-11-23" };
assert.equal(
  (
    await a.rpc("edit_occurrence", {
      ...mutation,
      operation: "move",
      new_start: "2026-11-23T01:00:00Z",
      new_end: "2026-11-23T02:00:00Z",
    })
  ).error,
  null,
);
assert.equal(
  (await a.rpc("edit_occurrence", { ...mutation, operation: "complete" }))
    .error,
  null,
);
const { data: change } = await a
  .from("occurrence_changes")
  .select("*")
  .eq("item_id", event.id)
  .single();
assert.equal(change.completed, true);
assert.equal(Date.parse(change.start_at), Date.parse("2026-11-23T01:00:00Z"));
assert.ok(
  (
    await a.rpc("edit_occurrence", {
      ...mutation,
      target_date: "2026-11-24",
      operation: "complete",
    })
  ).error,
);
for (const client of [b, anon]) {
  for (const [table, column, id] of [
    ["task_templates", "id", template.id],
    ["planner_items", "id", event.id],
    ["occurrence_changes", "item_id", event.id],
  ]) {
    const read = await client.from(table).select("*").eq(column, id);
    assert.ok(read.error || read.data.length === 0);
    const update = await client
      .from(table)
      .update(
        table === "occurrence_changes"
          ? { completed: false }
          : { title: "Unauthorized" },
      )
      .eq(column, id)
      .select();
    assert.ok(update.error || update.data.length === 0);
  }
  assert.ok(
    (await client.rpc("edit_occurrence", { ...mutation, operation: "cancel" }))
      .error,
  );
}
assert.ok(
  (
    await b.from("occurrence_changes").insert({
      user_id: bId,
      item_id: event.id,
      occurrence_date: "2026-11-23",
    })
  ).error,
);
assert.equal(
  (await a.from("planner_items").update({ locked: true }).eq("id", event.id))
    .error,
  null,
);
assert.ok(
  (
    await a
      .from("planner_items")
      .update({ title: "Forbidden while locked" })
      .eq("id", event.id)
  ).error,
);
assert.ok(
  (
    await a.rpc("edit_occurrence", {
      ...mutation,
      operation: "move",
      new_start: "2026-11-23T03:00Z",
      new_end: "2026-11-23T04:00Z",
    })
  ).error,
);
assert.equal(
  (await a.from("planner_items").update({ locked: false }).eq("id", event.id))
    .error,
  null,
);
assert.equal(
  (await a.from("planner_items").update({ archived: true }).eq("id", event.id))
    .error,
  null,
);
assert.equal(
  (
    await a
      .from("planner_items")
      .update({ archived: true })
      .eq("template_id", template.id)
  ).error,
  null,
);
assert.equal(
  (
    await a
      .from("task_templates")
      .update({ archived: true })
      .eq("id", template.id)
  ).error,
  null,
);
const { data: proposal, error: proposalError } = await a.rpc("save_proposal", {
  week_start: "2026-11-21T13:00:00Z",
  zone: "Australia/Melbourne",
  entries: [
    {
      id: event.id,
      title: "Proposal isolation",
      start_at: "2026-11-23T04:00Z",
      end_at: "2026-11-23T05:00Z",
    },
  ],
});
assert.equal(proposalError, null);
for (const client of [b, anon]) {
  const read = await client
    .from("schedule_proposals")
    .select("*")
    .eq("id", proposal);
  assert.ok(read.error || read.data.length === 0);
  const entries = await client
    .from("proposal_entries")
    .select("*")
    .eq("proposal_id", proposal);
  assert.ok(entries.error || entries.data.length === 0);
}
await Promise.all([a.auth.signOut(), b.auth.signOut()]);
console.log(
  "Passed real planner RLS, same-owner foreign keys, idempotent targets, exception preservation, recurrence validation and locks.",
);
