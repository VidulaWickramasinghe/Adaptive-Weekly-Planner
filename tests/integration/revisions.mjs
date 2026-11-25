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
  second = make(),
  anon = make();
async function login(client, letter) {
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env[`TEST_USER_${letter}_EMAIL`],
    password: process.env[`TEST_USER_${letter}_PASSWORD`],
  });
  assert.equal(error, null);
  return data.user.id;
}
const owner = await login(a, "A");
await login(b, "B");
await login(second, "A");
async function ok(query) {
  const { data, error } = await query;
  assert.equal(error, null);
  return data;
}
const profile = await ok(
  a.from("profiles").select("*").eq("user_id", owner).single(),
);
const ids = [];
const start = "2035-06-02T23:00:00Z",
  end = "2035-06-03T00:00:00Z",
  week = "2035-06-02T14:00:00Z";
async function item(patch = {}) {
  const row = await ok(
    a
      .from("planner_items")
      .insert({
        user_id: owner,
        title: "Revision integration",
        kind: "task",
        timezone: "Australia/Melbourne",
        duration: 60,
        ...patch,
      })
      .select()
      .single(),
  );
  ids.push(row.id);
  return row;
}
async function save(
  task,
  spans = [{ start_at: start, end_at: end }],
  fingerprint,
) {
  if (!fingerprint)
    fingerprint = (await ok(a.rpc("read_planning"))).fingerprint;
  return ok(
    a.rpc("save_revision", {
      week_start: week,
      zone: "Australia/Melbourne",
      start_hour: 9,
      end_hour: 17,
      fingerprint,
      entries: spans.map((s) => ({
        id: task.id,
        title: task.title,
        occurrence_key: "single",
        ...s,
      })),
    }),
  );
}
async function decide(id, operation, client = a) {
  return client.rpc("decide_revision", { target: id, operation });
}
try {
  await ok(
    a
      .from("profiles")
      .update({ preferred_daily_capacity: 1440 })
      .eq("user_id", owner),
  );
  const task = await item();
  const p = await save(task);
  for (const client of [b, anon]) {
    assert.ok((await decide(p, "accept", client)).error);
    for (const table of [
      "schedule_proposals",
      "schedule_slots",
      "revision_before",
      "revision_events",
    ]) {
      const r = await client.from(table).select("*").eq("user_id", owner);
      assert.ok(r.error || r.data.length === 0);
    }
  }
  assert.ok(
    (
      await a.from("schedule_slots").insert({
        user_id: owner,
        task_id: task.id,
        occurrence_key: "single",
        ordinal: 1,
        start_at: start,
        end_at: end,
      })
    ).error,
  );
  const [accept, retry] = await Promise.all([
    decide(p, "accept"),
    decide(p, "accept", second),
  ]);
  assert.equal(accept.error, null);
  assert.equal(retry.error, null);
  let slots = await ok(
    second.from("schedule_slots").select("*").eq("task_id", task.id),
  );
  assert.equal(slots.length, 1);
  await ok(decide(p, "undo"));
  await ok(decide(p, "undo"));
  assert.equal(
    (await ok(a.from("schedule_slots").select("*").eq("task_id", task.id)))
      .length,
    0,
  );
  const rejected = await save(task);
  await ok(decide(rejected, "reject"));
  assert.ok((await decide(rejected, "accept")).error);
  const stale = await save(task);
  await ok(
    a
      .from("planner_items")
      .update({ title: "Changed on second device" })
      .eq("id", task.id),
  );
  assert.ok((await decide(stale, "accept")).error);
  const invalid = await save(task, [
    { start_at: start, end_at: "2035-06-02T23:30:00Z" },
  ]);
  assert.ok((await decide(invalid, "accept")).error);
  assert.equal(
    (await ok(a.from("revision_before").select("*").eq("proposal_id", invalid)))
      .length,
    0,
  );
  const fixed = await item({
    kind: "commitment",
    start_at: start,
    end_at: end,
  });
  const collision = await save(task);
  assert.ok((await decide(collision, "accept")).error);
  await ok(
    a.from("planner_items").update({ archived: true }).eq("id", fixed.id),
  );
  const split = await item({
    duration: 120,
    can_split: true,
    minimum_session: 45,
  });
  const splitId = await save(split, [
    { start_at: start, end_at: end },
    { start_at: "2035-06-03T23:00:00Z", end_at: "2035-06-04T00:00:00Z" },
  ]);
  await ok(decide(splitId, "accept"));
  slots = await ok(
    a.from("schedule_slots").select("*").eq("task_id", split.id),
  );
  assert.equal(slots.length, 2);
  await ok(
    a.rpc("edit_schedule_slot", {
      target_id: split.id,
      target_key: "single",
      chunk: slots[0].ordinal,
      operation: "complete",
      expected_start: slots[0].start_at,
      expected_end: slots[0].end_at,
    }),
  );
  assert.equal(
    (
      await ok(
        a.from("planner_items").select("completed").eq("id", split.id).single(),
      )
    ).completed,
    true,
  );
  assert.ok((await decide(splitId, "undo")).error);
  // A roster-change undo must not restore an overlapping old placement.
  const manual = await item({
    start_at: "2035-06-05T23:00:00Z",
    end_at: "2035-06-06T00:00:00Z",
  });
  await item({
    kind: "commitment",
    start_at: manual.start_at,
    end_at: manual.end_at,
  });
  const move = await save(manual, [
    { start_at: "2035-06-06T23:00:00Z", end_at: "2035-06-07T00:00:00Z" },
  ]);
  await ok(decide(move, "accept"));
  assert.ok((await decide(move, "undo")).error);
  assert.equal(
    (
      await ok(
        a.from("schedule_proposals").select("status").eq("id", move).single(),
      )
    ).status,
    "accepted",
  );
  console.log(
    "Passed real revision ownership, concurrent retry, stale detection, rejection, atomic rollback, split identity, completion, cross-device persistence and safe undo checks.",
  );
} finally {
  for (const id of ids)
    await ok(a.from("planner_items").update({ archived: true }).eq("id", id));
  await ok(
    a
      .from("profiles")
      .update({ preferred_daily_capacity: profile.preferred_daily_capacity })
      .eq("user_id", owner),
  );
  await Promise.all([
    a.auth.signOut(),
    b.auth.signOut(),
    second.auth.signOut(),
  ]);
}
