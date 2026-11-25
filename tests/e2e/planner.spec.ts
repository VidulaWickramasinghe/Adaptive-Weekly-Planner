import { test, expect } from "@playwright/test";
test("create, reload, complete and archive an unscheduled task", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.TEST_USER_B_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_USER_B_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/planner");
  const title = "Planner verification " + Date.now();
  const form = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add an activity" }) });
  await form.getByLabel("Title", { exact: true }).fill(title);
  await form.getByLabel("Activity type").selectOption("task");
  await form.getByRole("button", { name: "Save activity" }).click();
  await expect(
    page.getByText(title + " · Unscheduled", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByText(title + " · Unscheduled", { exact: true }).click();
  const item = page
    .locator("details")
    .filter({ has: page.locator("summary").filter({ hasText: title }) })
    .first();
  await item.getByRole("button", { name: "Mark complete" }).click();
  await expect(
    page.getByText("✓ " + title + " · Unscheduled", { exact: true }),
  ).toBeVisible();
  await item.getByText("Remove activity", { exact: true }).click();
  await item.getByRole("button", { name: "Confirm archive" }).click();
  await expect(
    page.getByText("✓ " + title + " · Unscheduled", { exact: true }),
  ).toHaveCount(0);
});
