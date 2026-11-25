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
async function ok(query) {
  const r = await query;
  assert.equal(r.error, null);
  return r.data;
}
async function login(client, letter) {
  return (
    await ok(
      client.auth.signInWithPassword({
        email: process.env[`TEST_USER_${letter}_EMAIL`],
        password: process.env[`TEST_USER_${letter}_PASSWORD`],
      }),
    )
  ).user.id;
}
const owner = await login(a, "A"),
  other = await login(b, "B");
const course = await ok(
  a
    .from("workstreams")
    .insert({
      user_id: owner,
      title: "Integration study",
      kind: "study",
      weekly_target: 120,
    })
    .select()
    .single(),
);
const task = await ok(
  a
    .from("planner_items")
    .insert({
      user_id: owner,
      title: "Integration assignment",
      kind: "task",
      timezone: "Australia/Melbourne",
      workstream_id: course.id,
      duration: 45,
    })
    .select()
    .single(),
);
const restoredId = crypto.randomUUID();
let date = "2042-01-01";
while (
  (await ok(a.from("screen_time").select("local_date").eq("local_date", date)))
    .length
)
  date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
try {
  await ok(
    a.from("planner_items").update({ completed: true }).eq("id", task.id),
  );
  const completed = await ok(
    a.from("planner_items").select("*").eq("id", task.id).single(),
  );
  assert.ok(completed.completed_at);
  await ok(
    a
      .from("planner_items")
      .update({ title: "Completed assignment" })
      .eq("id", task.id),
  );
  assert.equal(
    (
      await ok(
        a
          .from("planner_items")
          .select("completed_at")
          .eq("id", task.id)
          .single(),
      )
    ).completed_at,
    completed.completed_at,
  );
  for (const client of [b, anon]) {
    const read = await client
      .from("workstreams")
      .select("*")
      .eq("id", course.id);
    assert.ok(read.error || read.data.length === 0);
    assert.ok(
      (
        await client.rpc("restore_backup", {
          backup: { format: 1, owner, data: {} },
        })
      ).error,
    );
  }
  assert.ok(
    (
      await b.from("planner_items").insert({
        user_id: other,
        title: "Cross-owner",
        kind: "task",
        timezone: "UTC",
        workstream_id: course.id,
      })
    ).error,
  );

  for (const kind of ["productive", "recreational"]) {
    const row = await a
      .from("screen_time")
      .select("*")
      .eq("local_date", date)
      .eq("kind", kind)
      .single();
    if (row.data)
      await ok(
        a
          .from("screen_time")
          .update({ minutes: 0 })
          .eq("local_date", date)
          .eq("kind", kind),
      );
    else
      await ok(
        a
          .from("screen_time")
          .insert({ user_id: owner, local_date: date, kind, minutes: 0 }),
      );
  }
  const screen = await ok(
    a
      .from("screen_time")
      .select("*")
      .eq("local_date", date)
      .eq("kind", "productive")
      .single(),
  );
  await ok(
    a
      .from("screen_time")
      .update({ minutes: 30 })
      .eq("local_date", date)
      .eq("kind", "productive")
      .eq("version", screen.version),
  );
  const stale = await ok(
    a
      .from("screen_time")
      .update({ minutes: 99 })
      .eq("local_date", date)
      .eq("kind", "productive")
      .eq("version", screen.version)
      .select(),
  );
  assert.equal(stale.length, 0);
  assert.equal(
    (await ok(b.from("screen_time").select("*").eq("user_id", owner))).length,
    0,
  );
  const backup = await ok(a.rpc("export_backup"));
  assert.equal(backup.owner, owner);
  const before = JSON.stringify(backup.data);
  assert.equal(await ok(a.rpc("restore_backup", { backup })), 0);
  assert.equal(await ok(a.rpc("restore_backup", { backup })), 0);
  assert.equal(JSON.stringify((await ok(a.rpc("export_backup"))).data), before);
  assert.ok(backup.data.planner_items.some((t) => t.id === task.id));
  const minimal = {
    format: 1,
    owner,
    data: {
      planner_items: [
        {
          ...completed,
          id: restoredId,
          title: "Recovered fixture",
          workstream_id: null,
        },
      ],
    },
  };
  assert.equal(await ok(a.rpc("restore_backup", { backup: minimal })), 1);
  assert.equal(await ok(a.rpc("restore_backup", { backup: minimal })), 0);
  minimal.data.planner_items[0].title = "Must not overwrite";
  await ok(a.rpc("restore_backup", { backup: minimal }));
  assert.equal(
    (
      await ok(
        a.from("planner_items").select("title").eq("id", restoredId).single(),
      )
    ).title,
    "Recovered fixture",
  );
  const invalid = structuredClone(minimal);
  invalid.data.planner_items[0].id = crypto.randomUUID();
  invalid.data.screen_time = [
    { user_id: other, local_date: date, kind: "productive", minutes: 1 },
  ];
  assert.ok((await a.rpc("restore_backup", { backup: invalid })).error);
  assert.equal(
    (
      await ok(
        a
          .from("planner_items")
          .select("id")
          .eq("id", invalid.data.planner_items[0].id),
      )
    ).length,
    0,
  );
  console.log(
    "Passed completion timestamps, project ownership, screen-time separation/stale writes, account-scoped backup, idempotent additive restore and atomic rollback.",
  );
} finally {
  await ok(
    a
      .from("planner_items")
      .update({ archived: true })
      .in("id", [task.id, restoredId]),
  );
  await ok(
    a.from("workstreams").update({ archived: true }).eq("id", course.id),
  );
  await a.from("screen_time").update({ minutes: 0 }).eq("local_date", date);
  await Promise.all([a.auth.signOut(), b.auth.signOut()]);
}
