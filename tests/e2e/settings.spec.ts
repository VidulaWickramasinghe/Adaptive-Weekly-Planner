import { test, expect, type Page } from "@playwright/test";
// Route interception must not be bypassed by a registered service worker.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.TEST_USER_A_EMAIL, "Requires local test accounts.");
  await login(page);
  await page.goto("/settings");
});
async function login(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(process.env.TEST_USER_A_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.TEST_USER_A_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/");
}
test("invalid zone retains the draft and shows validation", async ({
  page,
}) => {
  await page.getByLabel("Time zone").fill("Invalid/Zone");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Enter a valid" }),
  ).toBeVisible();
  await expect(page.getByLabel("Time zone")).toHaveValue("Invalid/Zone");
});
test("network failure retains edited settings and allows retry", async ({
  page,
}) => {
  const capacity = page.getByLabel("Preferred daily capacity");
  await capacity.fill("275");
  await page.route("**/settings", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Connection failed" }),
  ).toBeVisible();
  await expect(capacity).toHaveValue("275");
  await page.unroute("**/settings");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Settings saved." }),
  ).toBeVisible();
});
test("stale save is rejected without losing the draft", async ({
  page,
  browser,
}) => {
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await login(second);
    await second.goto("/settings");
    await second.getByLabel("Preferred daily capacity").fill("280");
    await second.getByRole("button", { name: "Save settings" }).click();
    await expect(
      second.getByRole("status").filter({ hasText: "Settings saved." }),
    ).toBeVisible();
    await page.getByLabel("Preferred daily capacity").fill("300");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "another device" }),
    ).toBeVisible();
    await expect(page.getByLabel("Preferred daily capacity")).toHaveValue(
      "300",
    );
    await page.reload();
    await expect(page.getByLabel("Preferred daily capacity")).toHaveValue(
      "280",
    );
  } finally {
    await other.close();
  }
});
test("expired session cookies return to sign-in", async ({ page, context }) => {
  const cookies = await context.cookies();
  for (const cookie of cookies.filter((cookie) =>
    cookie.name.startsWith("sb-"),
  )) {
    await context.addCookies([{ ...cookie, expires: 1 }]);
  }
  await page.goto("/settings");
  await expect(page).toHaveURL(/sign-in/);
});
test("settings support keyboard navigation and fit the viewport", async ({
  page,
}) => {
  await page.getByLabel("Time zone").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Preferred daily capacity")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/settings-${test.info().project.name}.png`,
    fullPage: true,
  });
});
