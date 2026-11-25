import { test, expect } from "@playwright/test";
test("private pages lead to sign-in and fit the viewport", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/sign-in/);
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/sign-in-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("authenticated preferences persist and sign-out protects routes", async ({
  page,
  browser,
}) => {
  test.skip(
    !process.env.TEST_USER_A_EMAIL,
    "Requires a real test account and configured Supabase.",
  );
  const login = async (target: typeof page) => {
    await target.goto("/sign-in");
    await target
      .getByLabel("Email address")
      .fill(process.env.TEST_USER_A_EMAIL!);
    await target
      .getByLabel("Password", { exact: true })
      .fill(process.env.TEST_USER_A_PASSWORD!);
    await target.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(target).toHaveURL("/");
  };
  await login(page);
  await page.getByRole("link", { name: /Settings/ }).click();
  const initialZone = await page.getByLabel("Time zone").inputValue();
  const zone =
    initialZone === "Australia/Melbourne"
      ? "Australia/Perth"
      : "Australia/Melbourne";
  await page.getByLabel("Time zone").fill(zone);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toHaveText("Settings saved.");
  await page.reload();
  await expect(page.getByLabel("Time zone")).toHaveValue(zone);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage);
  await otherPage.goto("/settings");
  await expect(otherPage.getByLabel("Time zone")).toHaveValue(zone);
  await other.close();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/sign-in/);
});
