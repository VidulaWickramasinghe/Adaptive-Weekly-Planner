import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Temporal } from "@js-temporal/polyfill";
import { planningWeek } from "../../src/domain/week";
async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.TEST_USER_A_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_USER_A_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}
test("review, accept, cross-device calendar, undo, stale approval and rejection", async ({
  page,
  browser,
}) => {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const login = await client.auth.signInWithPassword({
    email: process.env.TEST_USER_A_EMAIL!,
    password: process.env.TEST_USER_A_PASSWORD!,
  });
  expect(login.error).toBeNull();
  const owner = login.data.user!.id;
  const profile = await client
    .from("profiles")
    .select("*")
    .eq("user_id", owner)
    .single();
  expect(profile.error).toBeNull();
  const zone = profile.data.timezone;
  const week = planningWeek("2036-02-05T00:00Z", zone);
  const start = Temporal.PlainDate.from(week.dates[2])
    .toPlainDateTime({ hour: 11 })
    .toZonedDateTime(zone)
    .toInstant()
    .toString();
  const end = Temporal.Instant.from(start).add({ minutes: 30 }).toString();
  const title = "Browser revision " + crypto.randomUUID().slice(0, 8);
  const fixture = await client
    .from("planner_items")
    .insert({
      user_id: owner,
      title,
      kind: "task",
      timezone: zone,
      duration: 30,
    })
    .select()
    .single();
  expect(fixture.error).toBeNull();
  const id = fixture.data.id;
  const context = await browser.newContext();
  try {
    const capacity = await client
      .from("profiles")
      .update({ preferred_daily_capacity: 1440 })
      .eq("user_id", owner);
    expect(capacity.error).toBeNull();
    async function save() {
      const snapshot = await client.rpc("read_planning");
      expect(snapshot.error).toBeNull();
      const proposal = await client.rpc("save_revision", {
        week_start: week.start,
        zone,
        start_hour: 9,
        end_hour: 17,
        fingerprint: snapshot.data.fingerprint,
        entries: [
          { id, title, occurrence_key: "single", start_at: start, end_at: end },
        ],
      });
      expect(proposal.error).toBeNull();
      return proposal.data;
    }
    await signIn(page);
    await page.goto("/proposal?date=" + week.dates[0]);
    await page
      .getByRole("button", { name: "Save proposal for review" })
      .click();
    await expect(page).toHaveURL(/saved=/);
    await expect(
      page.getByRole("heading", { name: "Saved proposal", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Accept proposal", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Undo accepted proposal" }),
    ).toBeVisible();
    const second = await context.newPage();
    await signIn(second);
    await second.goto("/planner?view=agenda&date=" + week.dates[0]);
    await expect(
      second
        .getByLabel("Calendar", { exact: true })
        .getByText(title, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo accepted proposal" }).click();
    await expect(
      page.getByText("Status: undone.", { exact: false }),
    ).toBeVisible();
    await second.reload();
    await expect(
      second
        .getByLabel("Calendar", { exact: true })
        .getByText(title, { exact: true }),
    ).toHaveCount(0);
    const stale = await save();
    const edit = await client
      .from("planner_items")
      .update({ priority: "high" })
      .eq("id", id);
    expect(edit.error).toBeNull();
    await page.goto("/proposal?saved=" + stale);
    await page
      .getByRole("button", { name: "Accept proposal", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Planning inputs changed" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Reject proposal", exact: true })
      .click();
    await expect(
      page.getByText("Status: rejected.", { exact: false }),
    ).toBeVisible();
  } finally {
    await context.close();
    const archive = await client
      .from("planner_items")
      .update({ archived: true })
      .eq("id", id);
    expect(archive.error).toBeNull();
    const restore = await client
      .from("profiles")
      .update({
        preferred_daily_capacity: profile.data.preferred_daily_capacity,
      })
      .eq("user_id", owner);
    expect(restore.error).toBeNull();
    await client.auth.signOut();
  }
});
