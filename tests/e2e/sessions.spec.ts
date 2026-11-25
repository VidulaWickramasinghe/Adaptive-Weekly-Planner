import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
async function archiveFixtures() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email: process.env.TEST_USER_B_EMAIL!,
    password: process.env.TEST_USER_B_PASSWORD!,
  });
  if (error) throw error;
  for (const table of ["planner_items", "task_templates"]) {
    const { data, error: readError } = await client
      .from(table)
      .select("id,title");
    if (readError) throw readError;
    const ids = data
      .filter((row) => /^(Lecture|Study|Journal) [0-9]+$/.test(row.title))
      .map((row) => row.id);
    if (!ids.length) continue;
    if (table === "planner_items")
      await client.from(table).update({ locked: false }).in("id", ids);
    const { error: writeError } = await client
      .from(table)
      .update({ archived: true })
      .in("id", ids);
    if (writeError) throw writeError;
  }
  await client.auth.signOut();
}
test.beforeAll(archiveFixtures);
test.afterEach(archiveFixtures);
async function open(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.TEST_USER_B_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_USER_B_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/planner?date=2026-11-22");
}
test("weekly lecture exceptions, locks and views persist", async ({ page }) => {
  await open(page);
  const title = "Lecture " + Date.now();
  const add = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add an activity" }) });
  await add.getByLabel("Title", { exact: true }).fill(title);
  await add.getByLabel("Start", { exact: true }).fill("2026-11-23T09:00");
  await add.getByLabel("End", { exact: true }).fill("2026-11-23T10:00");
  await add.getByLabel("Repeat weekly").check();
  await add.getByRole("button", { name: "Save activity" }).click();
  const block = page.locator("article").filter({ hasText: title });
  await expect(block).toBeVisible();
  await block.getByText("Manage this occurrence").click();
  await block.getByRole("button", { name: "Complete occurrence" }).click();
  await expect(
    block.getByRole("button", { name: "Reopen occurrence" }),
  ).toBeVisible();
  await block.getByLabel("Occurrence start").fill("2026-11-23T11:00");
  await block.getByLabel("Occurrence end").fill("2026-11-23T12:00");
  await block.getByRole("button", { name: "Move this occurrence" }).click();
  // A previous completion can leave the same success text on screen.
  // Wait for the actual moved time before reloading.
  await expect(block).toContainText("11:00");
  await page.reload();
  await expect(block).toContainText("11:00");
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/date=2026-11-29/);
  await block.getByText("Manage this occurrence").click();
  await expect(
    block.getByRole("button", { name: "Complete occurrence" }),
  ).toBeVisible();
  await block.getByRole("button", { name: "Skip occurrence" }).click();
  await expect(block).toContainText("Skipped");
  await block.getByRole("button", { name: "Restore occurrence" }).click();
  const item = page
    .locator("details")
    .filter({
      has: page.locator("summary").filter({ hasText: title + " · Scheduled" }),
    })
    .first();
  await item.locator("summary").first().click();
  await item
    .getByRole("button", { name: "Lock activity", exact: true })
    .click();
  await expect(
    item.getByText("Unlock this activity to edit it."),
  ).toBeVisible();
  await expect(block.getByText("Manage this occurrence")).toHaveCount(0);
  await item
    .getByRole("button", { name: "Unlock activity", exact: true })
    .click();
  for (const mode of ["Month", "Day", "Agenda", "Week"]) {
    await page
      .getByRole("navigation", { name: "Calendar view" })
      .getByRole("link", { name: mode, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("view=" + mode.toLowerCase()));
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("region", { name: "Calendar" })).toBeVisible();
  }
  await page.goto("/planner?date=2026-11-22");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    caret: "initial",
    path: `test-results/planner-${test.info().project.name}.png`,
    fullPage: false,
  });
});
test("template targets are idempotent and routines complete per day", async ({
  page,
}) => {
  await open(page);
  const title = "Study " + Date.now();
  await page.getByText("Create template", { exact: true }).click();
  const create = page
    .locator("details")
    .filter({ has: page.getByText("Create template", { exact: true }) });
  await create.getByLabel("Template title").fill(title);
  await create.getByLabel("Sessions per week").fill("2");
  await create
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate sessions for 2026-11-22" })
    .click();
  const summaries = page
    .locator("summary")
    .filter({ hasText: title + " · Unscheduled" });
  await expect(summaries).toHaveCount(2);
  await page
    .getByRole("button", { name: "Generate sessions for 2026-11-22" })
    .click();
  await expect(summaries).toHaveCount(2);
  const add = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add an activity" }) });
  const routine = "Journal " + Date.now();
  await add.getByLabel("Title", { exact: true }).fill(routine);
  await add.getByLabel("Activity type").selectOption("routine");
  await add.getByLabel("Daily routine").check();
  await add.getByRole("button", { name: "Save activity" }).click();
  const checklist = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Daily checklist" }) });
  const day = checklist
    .locator("form")
    .filter({ hasText: routine })
    .filter({ hasText: "2026-11-22" });
  await day.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(
    day.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeVisible();
  const next = checklist
    .locator("form")
    .filter({ hasText: routine })
    .filter({ hasText: "2026-11-23" });
  await expect(
    next.getByRole("button", { name: "Complete", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    day.getByRole("button", { name: "Reopen", exact: true }),
  ).toBeVisible();
});
test("flexible tasks can be moved across days", async ({ page }, info) => {
  await open(page);
  const title = "Study " + Date.now();
  const add = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add an activity" }) });
  await add.getByLabel("Title", { exact: true }).fill(title);
  await add.getByLabel("Activity type").selectOption("task");
  await add.getByLabel("Start", { exact: true }).fill("2026-11-23T13:00");
  await add.getByLabel("End", { exact: true }).fill("2026-11-23T14:00");
  await add.getByRole("button", { name: "Save activity" }).click();
  const block = page.locator("article").filter({ hasText: title });
  await expect(block).toBeVisible();
  if (info.project.name === "desktop") {
    await block.dragTo(
      page
        .locator(".calendar-day")
        .filter({
          has: page.getByRole("heading", { name: "Tue, 24 Nov", exact: true }),
        }),
    );
  } else {
    await block.getByText("Manage this occurrence").click();
    await block.getByLabel("Occurrence start").fill("2026-11-24T13:00");
    await block.getByLabel("Occurrence end").fill("2026-11-24T14:00");
    await block.getByRole("button", { name: "Move this occurrence" }).click();
  }
  await expect(
    page
      .locator(".calendar-day")
      .filter({
        has: page.getByRole("heading", { name: "Tue, 24 Nov", exact: true }),
      })
      .getByText(title, { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".calendar-day")
      .filter({
        has: page.getByRole("heading", { name: "Tue, 24 Nov", exact: true }),
      })
      .getByText(title, { exact: true }),
  ).toBeVisible();
});
