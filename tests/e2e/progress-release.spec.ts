import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
test("study/publication completion, separate screen journal, safe restore and install metadata", async ({
  page,
  context,
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
  const suffix = crypto.randomUUID().slice(0, 8);
  const streams: string[] = [];
  let restoredId: string | undefined;
  let date = "2043-01-01";
  while (
    (
      await client
        .from("screen_time")
        .select("local_date")
        .eq("local_date", date)
    ).data?.length
  )
    date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(process.env.TEST_USER_A_EMAIL!);
    await page
      .getByLabel("Password", { exact: true })
      .fill(process.env.TEST_USER_A_PASSWORD!);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Today", exact: true }),
    ).toBeVisible();
    for (const kind of ["study", "publication"]) {
      await page.goto("/projects");
      const create = page.locator("section").filter({
        has: page.getByRole("heading", {
          name: "Create a course or publication",
          exact: true,
        }),
      });
      const title = kind + " " + suffix;
      await create.getByLabel("Project or course title").fill(title);
      await create
        .getByRole("combobox", { name: "Track", exact: true })
        .selectOption(kind);
      await create
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      const section = page.locator("section").filter({
        has: page.getByRole("heading", { name: title, exact: true }),
      });
      await expect(section).toBeVisible();
      const lookup = await client
        .from("workstreams")
        .select("id")
        .eq("title", title)
        .eq("user_id", owner)
        .single();
      expect(lookup.error).toBeNull();
      streams.push(lookup.data!.id);
      await section
        .getByText("Add a task or assignment", { exact: true })
        .click();
      await section
        .getByLabel("Task or assignment title")
        .fill("Session " + suffix);
      await section.getByLabel("Estimated minutes").fill("45");
      if (kind === "publication")
        await section.getByLabel("Publication stage").selectOption("draft");
      await section.getByRole("button", { name: "Add project task" }).click();
      await section
        .getByRole("button", { name: "Complete task", exact: true })
        .click();
      await expect(
        section.getByText("1 of 1 tasks complete across all weeks."),
      ).toBeVisible();
      await expect(section.getByText(/Completed 45m/)).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/progress?date=" + date);
    await page
      .getByLabel("Productive screen minutes", { exact: true })
      .fill("30");
    await page.getByRole("button", { name: "Save productive time" }).click();
    await expect(
      page.getByText("This week: 30 productive minutes"),
    ).toBeVisible();
    await page.getByLabel("Recreational screen minutes").fill("15");
    await page.getByRole("button", { name: "Save recreational time" }).click();
    await expect(
      page.getByText("This week: 15 recreational minutes"),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByLabel("Productive screen minutes", { exact: true }),
    ).toHaveValue("30");
    await expect(page.getByLabel("Recreational screen minutes")).toHaveValue(
      "15",
    );
    await page.goto("/settings");
    const backupResponse = await page.request.get("/api/backup");
    expect(backupResponse.status()).toBe(200);
    expect(backupResponse.headers()["cache-control"]).toContain("no-store");
    const backup = await backupResponse.json();
    expect(backup.owner).toBe(owner);
    const source = backup.data.planner_items.find(
      (i: { workstream_id: string }) => streams.includes(i.workstream_id),
    );
    expect(source).toBeTruthy();
    restoredId = crypto.randomUUID();
    const minimal = {
      format: 1,
      owner,
      data: {
        planner_items: [
          {
            ...source,
            id: restoredId,
            title: "Recovered " + suffix,
            workstream_id: null,
          },
        ],
      },
    };
    await page.getByLabel("Backup JSON file").setInputFiles({
      name: "test-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(minimal)),
    });
    await page
      .getByLabel("Restore missing records only", { exact: false })
      .check();
    await page
      .getByRole("button", { name: "Restore missing records", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Restored 1 missing records" }),
    ).toBeVisible();
    await page.getByLabel("Backup JSON file").setInputFiles({
      name: "test-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(minimal)),
    });
    await page
      .getByLabel("Restore missing records only", { exact: false })
      .check();
    await page
      .getByRole("button", { name: "Restore missing records", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Restored 0 missing records" }),
    ).toBeVisible();
    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()).display).toBe("standalone");
    expect((await page.request.get("/icon-192.png")).status()).toBe(200);
    const calendar = await page.request.get("/api/calendar");
    expect(calendar.status()).toBe(200);
    expect(await calendar.text()).toContain("BEGIN:VCALENDAR");
    await context.setOffline(true);
    await expect(
      page.getByRole("status").filter({ hasText: "You’re offline" }),
    ).toBeVisible();
    await context.setOffline(false);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Planning preferences." }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false).catch(() => {});
    if (streams.length) {
      expect(
        (
          await client
            .from("planner_items")
            .update({ archived: true })
            .in("workstream_id", streams)
        ).error,
      ).toBeNull();
      expect(
        (
          await client
            .from("workstreams")
            .update({ archived: true })
            .in("id", streams)
        ).error,
      ).toBeNull();
    }
    if (restoredId)
      expect(
        (
          await client
            .from("planner_items")
            .update({ archived: true })
            .eq("id", restoredId)
        ).error,
      ).toBeNull();
    await client
      .from("screen_time")
      .update({ minutes: 0 })
      .eq("local_date", date);
    await client.auth.signOut();
  }
});
