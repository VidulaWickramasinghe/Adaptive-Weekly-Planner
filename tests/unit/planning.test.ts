import { describe, it, expect } from "vitest";
import { planningWeek } from "../../src/domain/week";
import { settingsSchema } from "../../src/domain/settings";
describe("local planning weeks", () => {
  it("changes week at Melbourne Sunday midnight", () => {
    expect(
      planningWeek("2026-11-21T12:59:59Z", "Australia/Melbourne").dates[0],
    ).toBe("2026-11-15");
    expect(
      planningWeek("2026-11-21T13:00:00Z", "Australia/Melbourne").dates[0],
    ).toBe("2026-11-22");
  });
  it.each([
    ["2026-04-05T04:00:00Z", 169],
    ["2026-10-04T04:00:00Z", 167],
  ])("handles DST at %s", (instant, hours) => {
    const week = planningWeek(instant as string, "Australia/Melbourne");
    expect((Date.parse(week.end) - Date.parse(week.start)) / 3600000).toBe(
      hours,
    );
  });
  it("uses the configured zone rather than the host zone", () => {
    expect(planningWeek("2026-11-21T13:00:00Z", "UTC").dates[0]).toBe(
      "2026-11-15",
    );
  });
});
describe("settings validation", () => {
  it.each(["Mars/Olympus", "", "+10:00"])(
    "rejects invalid zone %s",
    (timezone) => {
      expect(
        settingsSchema.safeParse({
          timezone,
          preferred_daily_capacity: 240,
          version: 0,
        }).success,
      ).toBe(false);
    },
  );
  it.each([-1, 1441, 1.5])("rejects invalid minutes %s", (minutes) => {
    expect(
      settingsSchema.safeParse({
        timezone: "Australia/Melbourne",
        preferred_daily_capacity: minutes,
        version: 0,
      }).success,
    ).toBe(false);
  });
});
