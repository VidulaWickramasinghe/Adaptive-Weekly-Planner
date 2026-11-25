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
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];
if (required.some((key) => !process.env[key])) {
  console.error(
    "Integration test requires a migrated disposable Supabase project and two test accounts. See README.",
  );
  process.exit(1);
}
const makeClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const a = makeClient(),
  b = makeClient(),
  anonymous = makeClient();
const login = async (client, suffix) => {
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env[`TEST_USER_${suffix}_EMAIL`],
    password: process.env[`TEST_USER_${suffix}_PASSWORD`],
  });
  assert.equal(error, null);
  return data.user.id;
};
const aId = await login(a, "A"),
  bId = await login(b, "B");
assert.notEqual(aId, bId);
const before = await a.from("profiles").select("*").eq("user_id", aId).single();
assert.equal(before.error, null);
const saved = await a
  .from("profiles")
  .update({
    preferred_daily_capacity:
      (before.data.preferred_daily_capacity + 17) % 1441,
  })
  .eq("user_id", aId)
  .eq("version", before.data.version)
  .select()
  .single();
assert.equal(saved.error, null);
assert.equal(saved.data.version, before.data.version + 1);
const stale = await a
  .from("profiles")
  .update({ preferred_daily_capacity: 1 })
  .eq("user_id", aId)
  .eq("version", before.data.version)
  .select();
assert.deepEqual(stale.data, []);
for (const client of [b, anonymous]) {
  const read = await client.from("profiles").select("*").eq("user_id", aId);
  assert.ok(read.error || read.data.length === 0);
  const update = await client
    .from("profiles")
    .update({ preferred_daily_capacity: 1 })
    .eq("user_id", aId)
    .select();
  assert.ok(update.error || update.data.length === 0);
  const insert = await client.from("profiles").insert({ user_id: aId });
  assert.ok(insert.error);
}
const secondDevice = makeClient();
await login(secondDevice, "A");
const after = await secondDevice
  .from("profiles")
  .select("*")
  .eq("user_id", aId)
  .single();
assert.equal(after.error, null);
assert.equal(
  after.data.preferred_daily_capacity,
  saved.data.preferred_daily_capacity,
);
assert.equal(after.data.version, saved.data.version);
await Promise.all([a, b, secondDevice].map((client) => client.auth.signOut()));
console.log(
  "Passed ownership, anonymous access, stale updates and second-client persistence.",
);
